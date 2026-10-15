// Runs once when a server starts (Next's instrumentation hook), before it takes requests.

export async function register() {
  // Production keeps Figure images in R2 (ADR-0007). Without it they'd go to local disk, which
  // Render wipes on every deploy, so refuse to start instead. Not during `next build`.
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { missingR2Vars } = await import("./lib/figures/store");
  const missing = missingR2Vars();
  if (missing.length) {
    throw new Error(`Figure storage isn't configured: set ${missing.join(", ")} (docs/deploy.md § Figure storage)`);
  }
}
