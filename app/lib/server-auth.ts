import { ApiError, bearerToken, decodeBase64Url, jsonSegment, validateFirebaseClaims } from "./server-core";

const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
let keyCache: { keys: (JsonWebKey & { kid: string })[]; expires: number } | undefined;

export async function verifyFirebaseIdentity(request: Request) {
  const token = bearerToken(request);
  const [encodedHeader, encodedClaims, signature] = token.split(".");
  const header = jsonSegment(encodedHeader);
  if (header.alg !== "RS256" || typeof header.kid !== "string") throw new ApiError(401, "invalid_token", "Your sign-in session could not be verified.");
  const now = Date.now();
  if (!keyCache || keyCache.expires <= now) {
    const response = await fetch(JWKS_URL, { signal: AbortSignal.timeout(8000), redirect: "manual" });
    if (!response.ok) throw new ApiError(503, "identity_unavailable", "Google sign-in verification is temporarily unavailable. Please retry.");
    const data = await response.json() as { keys?: (JsonWebKey & { kid: string })[] };
    if (!Array.isArray(data.keys)) throw new ApiError(503, "identity_unavailable", "Google sign-in verification is temporarily unavailable.");
    const maxAge = Number(response.headers.get("cache-control")?.match(/max-age=(\d+)/)?.[1] || 300);
    keyCache = { keys: data.keys, expires: now + Math.min(maxAge, 21600) * 1000 };
  }
  const jwk = keyCache.keys.find(key => key.kid === header.kid);
  if (!jwk) throw new ApiError(401, "invalid_token", "Your sign-in session could not be verified. Sign in again.");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, decodeBase64Url(signature), new TextEncoder().encode(`${encodedHeader}.${encodedClaims}`));
  if (!valid) throw new ApiError(401, "invalid_token", "Your sign-in session could not be verified. Sign in again.");
  return validateFirebaseClaims(jsonSegment(encodedClaims));
}
