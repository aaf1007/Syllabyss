// Which extracted images become Figures (issue #7). Pure, so it's unit tested.
// - The same picture on more than REPEAT_LIMIT Pages is a logo or template art: none of its copies count.
// - The same picture twice on one Page counts once.
// - At most MAX_FIGURES per Source Document; the largest win.

export const MAX_FIGURES = 40;
export const REPEAT_LIMIT = 2;

export type Candidate = { n: number; pageIndex: number; sha256: string; sourceArea: number };

/** The `n`s of the candidates to keep, in the order given. */
export function selectFigures(candidates: Candidate[], max = MAX_FIGURES): Set<number> {
  const pagesWith = new Map<string, Set<number>>();
  for (const c of candidates) {
    const pages = pagesWith.get(c.sha256) ?? new Set();
    pages.add(c.pageIndex);
    pagesWith.set(c.sha256, pages);
  }
  const seen = new Set<string>();
  const kept = candidates.filter((c) => {
    if (pagesWith.get(c.sha256)!.size > REPEAT_LIMIT) return false;
    const key = `${c.pageIndex}:${c.sha256}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const largest = [...kept].sort((a, b) => b.sourceArea - a.sourceArea || a.n - b.n).slice(0, max);
  return new Set(largest.map((c) => c.n));
}
