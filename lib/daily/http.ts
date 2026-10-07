import "server-only";
import { getApiPlayer } from "@/lib/auth";
import { ensureGuest, getGuest } from "@/lib/guest";
import { RunError } from "@/lib/runs/run-engine";
import { SocialError } from "@/lib/social/errors";
import { ensureProfile } from "@/lib/social/profile";
import { DailyError } from "./queries";

/**
 * Shared wrapper for the Daily route handlers. `auth: "optional"` (today's teaser, the
 * archive, the global board) passes this browser's Guest, or null, when signed out;
 * `auth: "guest"` (playing today's puzzle) makes a Guest if there isn't one (#8).
 * A signed-in caller's Profile is filled in (so they show on boards); a Guest never gets one.
 * DailyError, RunError and SocialError → their status; `fn` returning null → 404.
 */
export async function dailyRoute(
  auth: "optional" | "guest",
  fn: (playerId: string | null) => Promise<unknown>,
  notFound = "Not found",
): Promise<Response> {
  const player = await getApiPlayer();
  try {
    if (player) await ensureProfile(player);
    const playerId = player ?? (auth === "guest" ? await ensureGuest() : await getGuest());
    const result = await fn(playerId);
    if (result === null) return Response.json({ error: notFound }, { status: 404 });
    return Response.json(result);
  } catch (e) {
    if (e instanceof DailyError || e instanceof RunError || e instanceof SocialError) {
      return Response.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
