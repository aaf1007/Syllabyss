-- #5: per-Player (and site-wide) rate limits on the routes that spend AI money: uploads, Game
-- generation, Sonar, page notes. Fixed windows: one row per (key, action, period), reset in place
-- when a new window starts, so the table never grows past Players x actions x periods.
-- key is a Player id, or '*' for the site-wide daily cap. No FK: '*' isn't a Player, and account
-- deletion removes a Player's rows explicitly (lib/account/delete.ts).
CREATE TABLE rate_limits (
  key           text    NOT NULL,
  action        text    NOT NULL,
  period_s      integer NOT NULL,
  window_start  bigint  NOT NULL,   -- epoch seconds, a multiple of period_s
  hits          integer NOT NULL,
  PRIMARY KEY (key, action, period_s)
);
