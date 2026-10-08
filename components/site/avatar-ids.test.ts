import { describe, expect, it } from "vitest";
import { AVATARS as SOCIAL_AVATARS, randomAvatar } from "@/lib/social/types";
import { AVATARS as DRAWN } from "@/components/ui/avatars";

// The API (lib/social) must accept every avatar the picker (components/ui) can draw.
describe("avatar ids", () => {
  it("lib/social AVATARS matches the drawn sprites, default first", () => {
    expect([...SOCIAL_AVATARS].sort()).toEqual(DRAWN.map((a) => a.id).sort());
    expect(SOCIAL_AVATARS[0]).toBe(DRAWN[0].id);
  });

  it("randomAvatar picks across the whole list (#17)", () => {
    expect(randomAvatar(() => 0)).toBe(SOCIAL_AVATARS[0]);
    expect(randomAvatar(() => 0.9999)).toBe(SOCIAL_AVATARS[SOCIAL_AVATARS.length - 1]);
    const seen = new Set(SOCIAL_AVATARS.map((_, i) => randomAvatar(() => i / SOCIAL_AVATARS.length)));
    expect(seen.size).toBe(SOCIAL_AVATARS.length);
  });
});
