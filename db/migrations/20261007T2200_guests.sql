-- Guests (#8, CONTEXT.md "Guest"): a signed-out visitor who plays today's Daily Dive gets a
-- players row (id 'guest_<uuid>', from an httpOnly cookie) so their Run is server-authoritative
-- like any other. Guests never appear on Leaderboards, Profiles or Friends, and earn no XP,
-- streaks or badges; every public read filters `NOT is_guest`.
ALTER TABLE players ADD COLUMN is_guest boolean NOT NULL DEFAULT false;
