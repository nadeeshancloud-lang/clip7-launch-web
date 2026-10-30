import { validateMediaUrl } from '../../lib/server-core';
import { analyzeMedia } from '../../lib/server-media';
import { body, failure, json, requireSameOrigin } from '../../lib/server-http';
export const dynamic='force-dynamic';
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const input=await body(request);
    const url=validateMediaUrl(input.url);
    return json(await analyzeMedia(url,request.signal));
  } catch(error) { return failure(error); }
}
