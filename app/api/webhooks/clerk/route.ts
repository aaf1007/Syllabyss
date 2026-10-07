import { after, type NextRequest } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { deletePlayerData, refreshPlayerAggregates } from "@/lib/account/delete";

// Clerk webhooks (#5). Signed with CLERK_WEBHOOK_SIGNING_SECRET (Clerk Dashboard → Webhooks);
// public by design, the signature is the auth. Subscribed events: user.deleted, so a user deleted
// from the Clerk Dashboard or Clerk's own profile UI loses their Syllabyss data too.
export async function POST(req: NextRequest) {
  let evt: Awaited<ReturnType<typeof verifyWebhook>>;
  try {
    evt = await verifyWebhook(req);
  } catch (e) {
    console.error("[clerk-webhook] verification failed:", e instanceof Error ? e.message : e);
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (evt.type === "user.deleted" && evt.data.id) {
    await deletePlayerData(evt.data.id);
    after(() => refreshPlayerAggregates().catch((e) => console.error("[clerk-webhook] aggregate refresh failed:", e)));
  }
  return new Response(null, { status: 204 });
}
