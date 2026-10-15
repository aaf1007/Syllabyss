-- #7 (ADR-0007): Figures, the images on a Page. The image is a WebP object in the Figure store
-- (private R2 bucket in production, local disk in dev); the row keeps its key and the description
-- Gemini wrote at upload, which is also placed in the Page's content_md as ![description](figure:<id>).
CREATE TABLE figures (
  id              uuid    PRIMARY KEY,                 -- set by the app: the object key and placeholder use it
  source_page_id  uuid    NOT NULL REFERENCES source_pages(id) ON DELETE CASCADE,
  position        integer NOT NULL,                    -- order on the Page, 0-based
  object_key      text    NOT NULL UNIQUE,
  width           integer NOT NULL,
  height          integer NOT NULL,
  sha256          text    NOT NULL,                    -- of the stored WebP
  description     text    NOT NULL,
  UNIQUE (source_page_id, position)
);

-- Objects whose rows are gone. Every way a Figure row can go (a Page, Source Document, Module or
-- Player delete, all by cascade) queues its object here in the same transaction, so a rolled-back
-- delete never loses an image. The app removes queued objects after the delete (lib/figures/sweep.ts);
-- anything a crash leaves behind is removed by the next sweep.
CREATE TABLE figure_orphans (
  object_key  text        PRIMARY KEY,
  queued_at   timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION queue_figure_orphan() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO figure_orphans (object_key) VALUES (OLD.object_key) ON CONFLICT DO NOTHING;
  RETURN NULL;
END $$;

CREATE TRIGGER figures_queue_orphan AFTER DELETE ON figures
  FOR EACH ROW EXECUTE FUNCTION queue_figure_orphan();
