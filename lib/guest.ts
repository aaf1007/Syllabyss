import "server-only";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { sql } from "./db";
import type { Db } from "./progress";
import { randomAvatar } from "./social/types";

// Guests (#8): signed-out visitors who play today's Daily Dive. A Guest is a players row with
// is_guest = true, found through an httpOnly cookie holding its id. The id is a random UUID, so
// it can't be guessed; it is never a Clerk id, so a cookie can't stand in for a Player.

export const GUEST_COOKIE = "syllabyss_guest";
const GUEST_ID = /^guest_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_AGE = 400 * 24 * 60 * 60; // the longest browsers keep a cookie

/** The Guest behind this request's cookie, or null. Only an existing Guest row counts. */
export async function getGuest(): Promise<string | null> {
  const id = (await cookies()).get(GUEST_COOKIE)?.value;
  if (!id || !GUEST_ID.test(id)) return null;
  const [row] = await sql`select 1 from players where id = ${id} and is_guest`;
  return row ? id : null;
}

/** This request's Guest, created (row and cookie) if there isn't one. Route handlers only. */
export async function ensureGuest(): Promise<string> {
  const existing = await getGuest();
  if (existing) return existing;
  const id = `guest_${randomUUID()}`;
  await sql`insert into players (id, is_guest, avatar) values (${id}, true, ${randomAvatar()})`;
  (await cookies()).set(GUEST_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
  return id;
}

/** Whether `playerId` is a Guest. */
export async function isGuest(playerId: string, db: Db = sql): Promise<boolean> {
  const [row] = await db<{ is_guest: boolean }[]>`select is_guest from players where id = ${playerId}`;
  return row?.is_guest ?? false;
}
