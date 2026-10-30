import { env } from "cloudflare:workers";
import { ApiError, allowance, deviceTier, RESERVATION_MS, WINDOW_MS, RESERVE_DOWNLOAD_SQL, START_QUOTA_SQL } from "./server-core";

type WindowRow = { uid: string; device: string; allowance: number; generation: number; started_at: number | null; used: number };
type RecordRow = { id: string; uid: string; generation: number; status: string; created_at: number };

function database() {
  if (!env.DB) throw new ApiError(503, "account_unavailable", "Download allowances are temporarily unavailable. Please retry shortly.");
  return env.DB;
}

export async function ensureWindow(uid: string, request: Request, now = Date.now()) {
  const db = database();
  const device = deviceTier(request.headers.get("user-agent"));
  await db.prepare(`INSERT INTO quota_windows(uid, device, allowance, generation, started_at, used)
    VALUES (?, ?, ?, 1, NULL, 0)
    ON CONFLICT(uid) DO UPDATE SET device=excluded.device, allowance=excluded.allowance,
    generation=quota_windows.generation+1, started_at=NULL, used=0
    WHERE quota_windows.started_at IS NOT NULL AND quota_windows.started_at <= ?`)
    .bind(uid, device, allowance(device), now - WINDOW_MS).run();
  // Expired pre-stream reservations never consume credits or pin an allowance.
  await db.prepare(`UPDATE download_records SET status='expired' WHERE uid=? AND status='reserved' AND created_at < ?`)
    .bind(uid, now - RESERVATION_MS).run();
  const row = await db.prepare(`SELECT * FROM quota_windows WHERE uid=?`).bind(uid).first<WindowRow>();
  if (!row) throw new ApiError(503, "account_unavailable", "Your allowance could not be loaded. Please retry.");
  return row;
}

export async function quotaFor(uid: string, request: Request) {
  const row = await ensureWindow(uid, request);
  const pending = await database().prepare(`SELECT COUNT(*) AS count FROM download_records WHERE uid=? AND generation=? AND status='reserved'`)
    .bind(uid, row.generation).first<{count: number}>();
  return {
    limit: row.allowance, used: row.used, reserved: pending?.count || 0,
    remaining: Math.max(0, row.allowance - row.used - (pending?.count || 0)),
    resetAt: row.started_at ? row.started_at + WINDOW_MS : null,
    device: row.device, windowHours: 48, counting: "successful_stream_initiation",
  };
}

export async function reserveDownload(uid: string, request: Request, input: { key: string; source: string; title: string; formatId: string; formatLabel: string }) {
  const db = database();
  const row = await ensureWindow(uid, request);
  const prior = await db.prepare(`SELECT id,uid,generation,status,created_at FROM download_records WHERE uid=? AND idempotency_key=?`)
    .bind(uid, input.key).first<RecordRow>();
  if (prior) throw new ApiError(409, "duplicate_download", prior.status === "started" ? "This download has already started. Check your downloads before trying again." : "This download request has already been processed. Please start a new attempt.");
  const id = crypto.randomUUID();
  // One conditional INSERT is serialized by SQLite/D1. Pending requests count
  // towards capacity, so concurrent requests cannot overbook the allowance.
  const result = await db.prepare(RESERVE_DOWNLOAD_SQL)
    .bind(id, input.key, input.source, input.title.slice(0, 300), input.formatId, input.formatLabel, Date.now(), uid, row.generation, uid, row.generation).run();
  if (!result.meta.changes) {
    const duplicate = await db.prepare(`SELECT id FROM download_records WHERE uid=? AND idempotency_key=?`).bind(uid, input.key).first();
    if (duplicate) throw new ApiError(409, "duplicate_download", "This download request is already in progress.");
    throw new ApiError(429, "quota_exhausted", "Your web downloads are used up. Get Clip Sevan for unlimited free downloads, or return after your allowance resets.");
  }
  return { id, generation: row.generation };
}

export async function startReservedDownload(uid: string, record: { id: string; generation: number }) {
  const db = database();
  const now = Date.now();
  const result = await db.batch([
    db.prepare(START_QUOTA_SQL)
      .bind(now, uid, record.generation, record.id, uid),
    db.prepare(`UPDATE download_records SET status='started', started_at=? WHERE id=? AND uid=? AND status='reserved'
      AND EXISTS (SELECT 1 FROM quota_windows WHERE uid=? AND generation=?)`)
      .bind(now, record.id, uid, uid, record.generation),
  ]);
  if (!result[0].meta.changes || !result[1].meta.changes) throw new ApiError(409, "download_expired", "This download request expired. Please try again.");
}

export async function releaseDownload(uid: string, id: string, canceled = false) {
  await database().prepare(`UPDATE download_records SET status=? WHERE id=? AND uid=? AND status='reserved'`)
    .bind(canceled ? "canceled" : "failed", id, uid).run();
}

export async function historyFor(uid: string) {
  const result = await database().prepare(`SELECT id, title, source, format_label AS format, status, created_at AS createdAt, started_at AS startedAt
    FROM download_records WHERE uid=? ORDER BY created_at DESC LIMIT 50`).bind(uid).all();
  return { records: result.results, counting: "successful_stream_initiation" };
}
