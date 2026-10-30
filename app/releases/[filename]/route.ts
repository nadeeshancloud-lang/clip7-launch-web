import { releaseResponse } from "../../lib/server-release";
import { failure } from "../../lib/server-http";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ filename: string }> };
export async function GET(request: Request, context: Context) {
  try { return await releaseResponse(request, (await context.params).filename); }
  catch (error) { return failure(error); }
}
export async function HEAD(request: Request, context: Context) { return GET(request, context); }
