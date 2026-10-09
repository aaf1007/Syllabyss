import { after } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { deletePlayerData, refreshPlayerAggregates } from "@/lib/account/delete";
import { DELETE_CONFIRM_PHRASE } from "@/lib/account/confirm";
import { getApiPlayer } from "@/lib/auth";

/**
 * DELETE /api/me/account `{ confirm: "delete my account" }` (#5): erases all of the Player's data,
 * then their Clerk user. 204 on success. The Clerk `user.deleted` webhook runs the same data delete
 * again, which also catches anything a still-open tab re-created in between.
 */
export async function DELETE(req: Request) {
  const playerId = await getApiPlayer();
  if (!playerId) return Response.json({ error: "Not signed in" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { confirm?: unknown } | null;
  if (body?.confirm !== DELETE_CONFIRM_PHRASE) {
    return Response.json({ error: `Type "${DELETE_CONFIRM_PHRASE}" to confirm` }, { status: 400 });
  }

  await deletePlayerData(playerId);
  after(() => refreshPlayerAggregates().catch((e) => console.error("[account] aggregate refresh failed:", e)));

  try {
    await (await clerkClient()).users.deleteUser(playerId);
  } catch (e) {
    // Already gone from Clerk (or a DEV_PLAYER_ID that never existed there): the data delete is what matters.
    if (!(isClerkAPIResponseError(e) && e.status === 404)) {
      console.error("[account] Clerk deleteUser failed:", e);
      return Response.json(
        { error: "Your data was deleted, but we couldn't remove your sign-in. Try again in a minute." },
        { status: 502 },
      );
    }
  }
  return new Response(null, { status: 204 });
}
