# Keep Figures in Cloudflare R2

Amends ADR-0003. Uploads now also produce **Figures**: the images embedded in a PDF, PPTX or DOCX, plus a whole-page render of any PDF page whose text layer is nearly empty (scans). At upload, Gemini writes each Figure's description, and the description is placed in the Page's markdown as `![<description>](figure:<id>)`. Generation, Evidence and matching therefore keep reading text only. The image itself is kept so the study view can show it. The original file is still not kept: only the extracted Figure images are.

Figure images live in a **private Cloudflare R2 bucket**, accessed through the S3 SDK. Browsers never get a public URL. They ask `/api/figures/<id>`, which checks that the Player owns the Module (or that the Game is public) and redirects to a signed URL valid for about 5 minutes. When the `R2_*` env vars are missing, a local-disk store is used in dev and tests. In production, missing vars are a startup error, because Render's disk is wiped on each deploy.

## Considered options

- **Image bytes in Postgres:** rejected. Images would make up most of the database's size and its backups, on a DB that is meant for gameplay data.
- **AWS S3:** works the same way through the same SDK, but it charges for downloads and its setup (IAM user and policy) has more steps. R2 has free downloads and a free tier with no time limit.
- **A public bucket with unguessable keys:** rejected. A leaked link would expose a private Module's content permanently.
- **Descriptions only, no stored image:** rejected. Players want to see the diagram, not just read about it.

## Consequences

- R2 becomes a production dependency, with its own secrets in Render and CI's deploy job.
- Deleting a Source Document or Module must also delete its Figures from R2. That runs after the DB transaction commits, so a crash at that moment can leave orphaned objects behind, but never a missing image.
- Documents uploaded before this change have no Figures, because their bytes are gone. They only get Figures if uploaded again.
- Scanned PDFs no longer fail. Their Pages get text through Gemini OCR, which replaces the "No text could be read…" error described in ADR-0003.
