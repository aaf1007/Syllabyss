import { describe, expect, test } from "vitest";
import { selectFigures, type Candidate } from "./select";

const c = (n: number, pageIndex: number, sha256: string, sourceArea = 1000): Candidate => ({ n, pageIndex, sha256, sourceArea });

describe("selectFigures", () => {
  test("keeps distinct pictures", () => {
    expect(selectFigures([c(0, 0, "a"), c(1, 1, "b")])).toEqual(new Set([0, 1]));
  });

  test("a picture on more than two Pages is a logo: every copy goes", () => {
    const logo = [c(0, 0, "logo"), c(1, 1, "logo"), c(2, 2, "logo")];
    expect(selectFigures([...logo, c(3, 1, "chart")])).toEqual(new Set([3]));
  });

  test("a picture on two Pages stays on both", () => {
    expect(selectFigures([c(0, 0, "a"), c(1, 4, "a")])).toEqual(new Set([0, 1]));
  });

  test("the same picture twice on one Page counts once", () => {
    expect(selectFigures([c(0, 0, "a"), c(1, 0, "a")])).toEqual(new Set([0]));
  });

  test("over the cap, the largest win", () => {
    expect(selectFigures([c(0, 0, "a", 10), c(1, 0, "b", 30), c(2, 1, "c", 20)], 2)).toEqual(new Set([1, 2]));
  });
});
