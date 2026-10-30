export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export const WINDOW_MS = 48 * 60 * 60 * 1000;
export const RESERVATION_MS = 10 * 60 * 1000;
export const PROJECT_ID = "clip-sevan";
export const API_ORIGIN = "https://vurix-amila-api-658652589590.europe-west1.run.app";
export const RESERVE_DOWNLOAD_SQL = `INSERT OR IGNORE INTO download_records
  (id, uid, idempotency_key, generation, source, title, format_id, format_label, status, created_at)
  SELECT ?, uid, ?, generation, ?, ?, ?, ?, 'reserved', ? FROM quota_windows
  WHERE uid=? AND generation=? AND used +
  (SELECT COUNT(*) FROM download_records WHERE uid=? AND generation=? AND status='reserved') < allowance`;
export const START_QUOTA_SQL = `UPDATE quota_windows SET used=used+1, started_at=COALESCE(started_at, ?)
  WHERE uid=? AND generation=? AND EXISTS
  (SELECT 1 FROM download_records WHERE id=? AND uid=? AND status='reserved')`;

export function deviceTier(userAgent: string | null) {
  return /android|iphone|ipad|ipod|mobile|windows phone/i.test(userAgent || "") ? "mobile" : "desktop";
}
export function allowance(device: string) { return device === "mobile" ? 25 : 35; }

export function validateMediaUrl(value: unknown): string {
  if (typeof value !== "string" || value.length > 4096) throw new ApiError(400, "invalid_url", "Paste a valid public HTTPS media link.");
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new ApiError(400, "invalid_url", "Paste a complete HTTPS media link."); }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
    throw new ApiError(400, "invalid_url", "Use a public HTTPS link without account credentials or a custom port.");
  }
  // Source URLs are passed only to the existing media service, never fetched here.
  // Restrict them to public DNS names, including rejection of all IP literals.
  if (!host.includes(".") || host.includes(":") || /^\[/.test(host) || /^[\d.]+$/.test(host) ||
      /(^|\.)(localhost|local|internal|test|invalid|example|onion)$/.test(host) ||
      /(^|\.)(nip\.io|sslip\.io|localtest\.me)$/.test(host)) {
    throw new ApiError(400, "invalid_url", "This link does not point to a public media website.");
  }
  url.hash = "";
  return url.toString();
}

export function bearerToken(request: Request): string {
  const value = request.headers.get("authorization");
  if (!value || !/^Bearer [A-Za-z0-9._-]+$/.test(value)) throw new ApiError(401, "sign_in_required", "Continue with Google to start your download.");
  const token = value.slice(7);
  if (token.length > 16384 || token.split(".").length !== 3) throw new ApiError(401, "invalid_token", "Your sign-in session could not be verified. Sign in again.");
  return token;
}

export function validateIdempotencyKey(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{16,100}$/.test(value)) throw new ApiError(400, "invalid_request", "Please retry this download.");
  return value;
}

export function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  try {
    const bytes = atob(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "="));
    return Uint8Array.from(bytes, c => c.charCodeAt(0));
  } catch { throw new ApiError(401, "invalid_token", "Your sign-in session could not be verified."); }
}

export function jsonSegment(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid JWT segment");
    return parsed;
  }
  catch { throw new ApiError(401, "invalid_token", "Your sign-in session could not be verified."); }
}

export function validateFirebaseClaims(claims: Record<string, unknown>, now = Date.now()) {
  const seconds = Math.floor(now / 1000);
  if (claims.aud !== PROJECT_ID || claims.iss !== `https://securetoken.google.com/${PROJECT_ID}` ||
      typeof claims.sub !== "string" || !claims.sub || claims.sub.length > 128 ||
      typeof claims.exp !== "number" || claims.exp <= seconds ||
      typeof claims.iat !== "number" || claims.iat < 0 || claims.iat > seconds + 30 || claims.iat >= claims.exp ||
      typeof claims.auth_time !== "number" || claims.auth_time < 0 || claims.auth_time > seconds + 30) {
    throw new ApiError(401, "invalid_token", "Your sign-in session has expired or could not be verified. Sign in again.");
  }
  const firebase = claims.firebase as { sign_in_provider?: string } | undefined;
  if (firebase?.sign_in_provider !== "google.com") throw new ApiError(401, "google_required", "Continue with your Google account to download.");
  return { uid: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
}

export function safeFilename(value: string, ext = "bin") {
  const name = value.replace(/[\x00-\x1f\x7f<>:"/\\|?*]/g, "_").replace(/^\.+/, "").slice(0, 140).trim() || "Clip7-media";
  const extension = /^[a-z0-9]{2,5}$/i.test(ext) ? ext.toLowerCase() : "bin";
  return name.toLowerCase().endsWith(`.${extension}`) ? name : `${name}.${extension}`;
}
