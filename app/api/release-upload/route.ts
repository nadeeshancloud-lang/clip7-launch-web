import { ApiError } from "../../lib/server-core";
import { completeRelease, expectedPartSize, PART_COUNT, partKey, releaseBucket, verifyUploadAccess } from "../../lib/server-release";
import { failure, json } from "../../lib/server-http";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    verifyUploadAccess(request);
    const query = new URL(request.url).searchParams;
    if (query.get("complete") === "1") return json({ release: await completeRelease() });
    const rawPart = query.get("part");
    if (!rawPart || !/^\d+$/.test(rawPart)) throw new ApiError(400, "invalid_part", "Specify a valid release part.");
    const part = Number(rawPart);
    if (part < 0 || part >= PART_COUNT) throw new ApiError(400, "invalid_part", "Specify a valid release part.");
    const expected = expectedPartSize(part);
    const length = Number(request.headers.get("content-length"));
    if (length !== expected) throw new ApiError(400, "invalid_size", `Release part ${part} must contain exactly ${expected} bytes.`);
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength !== expected) throw new ApiError(400, "invalid_size", "Release part size does not match.");
    await releaseBucket().put(partKey(part), bytes, { httpMetadata: { contentType: "application/octet-stream" } });
    return json({ part, bytes: bytes.byteLength, uploaded: true });
  } catch (error) { return failure(error); }
}
