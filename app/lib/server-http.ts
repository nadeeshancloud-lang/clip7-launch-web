import { ApiError } from "./server-core";

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
export function failure(error: unknown) {
  if (error instanceof ApiError) return json({ error: { code: error.code, message: error.message } }, error.status);
  if (error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError")) return json({ error: { code: "timeout", message: "The media service took too long. Please retry your link." } }, 504);
  const diagnostic=error as {name?:string;cause?:{name?:string;code?:string};code?:string};
  const technical=error instanceof Error ? error.message.replace(/https?:\/\/\S+/gi,"[url]").replace(/[A-Za-z0-9_-]{32,}/g,"[redacted]").slice(0,160) : "";
  console.error("Clip7 request failed", diagnostic?.name || "unknown", diagnostic?.code || diagnostic?.cause?.code || "", diagnostic?.cause?.name || "",technical);
  return json({ error: { code: "service_unavailable", message: "The service is temporarily unavailable. Please retry shortly." } }, 503);
}
export async function body(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new ApiError(415, "invalid_request", "This request must use JSON.");
  if (Number(request.headers.get("content-length") || 0) > 8192) throw new ApiError(413, "invalid_request", "The submitted link is too long.");
  const text = await request.text();
  if (text.length > 8192) throw new ApiError(413, "invalid_request", "The submitted link is too long.");
  try {
    const value=JSON.parse(text);
    if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Invalid JSON body");
    return value as Record<string, unknown>;
  }
  catch { throw new ApiError(400, "invalid_request", "The request could not be read. Please retry."); }
}
export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new ApiError(403, "origin_rejected", "This action must be started from Clip7.");
}
