import { env } from "cloudflare:workers";
import { createHash, timingSafeEqual } from "node:crypto";
import { ApiError } from "./server-core";

export const RELEASE_NAME = "Clip-Sevan-2.0.0-Beta.apk";
export const RELEASE_BYTES = 109365263;
export const RELEASE_SHA256 = "de5a713371668d46c012d5934b66f8adb1f28c4def363054389ac53463c085f1";
export const PART_BYTES = 8 * 1024 * 1024;
export const PART_COUNT = Math.ceil(RELEASE_BYTES / PART_BYTES);
export const partKey = (part: number) => `release/2.0.0-beta/part-${part}`;
export const manifestKey = "release/2.0.0-beta/manifest.json";
export const expectedPartSize = (part: number) => Math.min(PART_BYTES, RELEASE_BYTES - part * PART_BYTES);

export function releaseBucket() {
  if (!env.BUCKET) throw new ApiError(503, "release_unavailable", "The Android release is temporarily unavailable. Please retry shortly.");
  return env.BUCKET;
}

export function verifyUploadAccess(request: Request) {
  const secret = (env as unknown as { RELEASE_UPLOAD_TOKEN?: string }).RELEASE_UPLOAD_TOKEN;
  const submitted = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!secret || !submitted) throw new ApiError(403, "forbidden", "Release upload is not enabled.");
  const expected = Buffer.from(secret);
  const actual = Buffer.from(submitted);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new ApiError(403, "forbidden", "Release upload is not authorized.");
}

export async function completeRelease() {
  const bucket = releaseBucket();
  const hash = createHash("sha256");
  for (let part = 0; part < PART_COUNT; part++) {
    const object = await bucket.get(partKey(part));
    if (!object || object.size !== expectedPartSize(part)) throw new ApiError(409, "incomplete_release", `Release part ${part} is missing or has the wrong size.`);
    const reader = object.body.getReader();
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      hash.update(chunk.value);
    }
  }
  const sha256 = hash.digest("hex");
  if (sha256 !== RELEASE_SHA256) throw new ApiError(409, "checksum_mismatch", "The assembled APK checksum does not match the owner-supplied release.");
  const manifest = { name: RELEASE_NAME, version: "2.0.0-beta", bytes: RELEASE_BYTES, sha256, partBytes: PART_BYTES, partCount: PART_COUNT, completedAt: new Date().toISOString() };
  await bucket.put(manifestKey, JSON.stringify(manifest), { httpMetadata: { contentType: "application/json" } });
  return manifest;
}

export async function releaseResponse(request: Request, filename: string) {
  if (filename !== RELEASE_NAME) throw new ApiError(404, "not_found", "This release was not found.");
  const bucket = releaseBucket();
  const manifest = await bucket.get(manifestKey);
  if (!manifest) throw new ApiError(503, "release_unavailable", "The Android release is being prepared. Please retry shortly.");
  const headers = {
    "Content-Type": "application/vnd.android.package-archive",
    "Content-Length": String(RELEASE_BYTES),
    "Content-Disposition": `attachment; filename="${RELEASE_NAME}"`,
    "ETag": `"sha256-${RELEASE_SHA256}"`,
    "Cache-Control": "public, max-age=86400, immutable",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "none",
  };
  if (request.method === "HEAD") return new Response(null, { headers });
  let part = 0;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        for (;;) {
          if (!reader) {
            if (part >= PART_COUNT) { controller.close(); return; }
            const object = await bucket.get(partKey(part++));
            if (!object) throw new Error("Release part unavailable");
            reader = object.body.getReader();
          }
          const result = await reader.read();
          if (result.done) { reader.releaseLock(); reader = null; continue; }
          controller.enqueue(result.value); return;
        }
      } catch (error) { controller.error(error); }
    },
    async cancel() { if (reader) await reader.cancel(); },
  });
  return new Response(stream, { headers });
}
