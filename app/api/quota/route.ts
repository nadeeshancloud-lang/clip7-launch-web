import { verifyFirebaseIdentity } from "../../lib/server-auth";
import { quotaFor } from "../../lib/server-db";
import { failure, json } from "../../lib/server-http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try { const user = await verifyFirebaseIdentity(request); return json(await quotaFor(user.uid, request)); }
  catch (error) { return failure(error); }
}
