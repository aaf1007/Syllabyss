import { after } from "next/server";
import { getApiPlayer } from "@/lib/auth";
import { deleteModule } from "@/app/modules/_lib/delete-module";
import { sweepFigureOrphansLater } from "@/lib/figures/sweep";

/** Deletes a Module with its files, Games, Runs and guesses (#9). XP already earned stays. */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/modules/[moduleId]">) {
  const playerId = await getApiPlayer();
  if (!playerId) return Response.json({ error: "Not signed in" }, { status: 401 });
  if (!(await deleteModule(playerId, (await ctx.params).moduleId))) {
    return Response.json({ error: "Module not found" }, { status: 404 });
  }
  after(sweepFigureOrphansLater); // the Module's Figure images
  return new Response(null, { status: 204 });
}
