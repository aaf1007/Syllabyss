import { getApiPlayer } from "@/lib/auth";
import { getVisibleFigureKey } from "@/lib/figures/queries";
import { figureStore, SIGNED_URL_SECONDS } from "@/lib/figures/store";

/**
 * One Figure's image (ADR-0007), for the study view and the Reveal: `![…](figure:<id>)` renders as
 * this URL. Owner of the Source Document, or a public Game's file, only; anyone else gets 404.
 * With R2, a redirect to a signed URL valid for a few minutes; with the local store, the bytes.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/figures/[figureId]">) {
  const playerId = await getApiPlayer();
  if (!playerId) return Response.json({ error: "Not signed in" }, { status: 401 });
  const key = await getVisibleFigureKey(playerId, (await ctx.params).figureId);
  if (!key) return Response.json({ error: "Figure not found" }, { status: 404 });

  const store = figureStore();
  const url = await store.signedUrl(key);
  if (url) {
    // The browser may reuse the redirect while the signed URL is still valid.
    return new Response(null, {
      status: 302,
      headers: { Location: url, "Cache-Control": `private, max-age=${SIGNED_URL_SECONDS - 60}` },
    });
  }
  const bytes = await store.get(key);
  if (!bytes) return Response.json({ error: "Figure not found" }, { status: 404 });
  return new Response(new Blob([bytes as BlobPart], { type: "image/webp" }), {
    headers: { "Cache-Control": "private, max-age=3600" },
  });
}
