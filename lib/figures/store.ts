import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

// Where Figure images live (ADR-0007): a private Cloudflare R2 bucket through the S3 SDK in
// production, a folder on local disk in dev, tests and CI. Browsers never get a bucket URL:
// /api/figures/<id> checks access, then redirects to a short-lived signed URL (R2) or streams
// the bytes itself (local).
//
// Server only, but no "server-only" import, so scripts and unit tests can load it.

export type FigureStore = {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  /** A short-lived URL the browser can fetch the object from, or null when the route must stream it. */
  signedUrl(key: string): Promise<string | null>;
  /** The object's bytes, or null when it's missing. */
  get(key: string): Promise<Uint8Array | null>;
  /** Removes objects; missing ones are fine. */
  delete(keys: string[]): Promise<void>;
};

/** How long a signed URL stays valid. */
export const SIGNED_URL_SECONDS = 300;

const R2_VARS = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"] as const;

/** The R2 env vars that aren't set. Production refuses to start without them (instrumentation.ts). */
export function missingR2Vars(env: Record<string, string | undefined> = process.env): string[] {
  return R2_VARS.filter((v) => !env[v]);
}

let store: FigureStore | undefined;

/** R2 when every R2_* var is set, otherwise local disk (FIGURES_DIR, default ./.figures). */
export function figureStore(): FigureStore {
  if (store) return store;
  if (missingR2Vars().length === 0) {
    store = r2Store({
      accountId: process.env.R2_ACCOUNT_ID!,
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      bucket: process.env.R2_BUCKET!,
    });
  } else {
    store = localStore(process.env.FIGURES_DIR || path.join(process.cwd(), ".figures"));
  }
  return store;
}

/** A folder on disk. Keys are our own ids, but resolve them inside `dir` anyway. */
export function localStore(dir: string): FigureStore {
  const file = (key: string) => {
    const p = path.resolve(dir, key);
    if (!p.startsWith(path.resolve(dir) + path.sep)) throw new Error(`Bad figure key: ${key}`);
    return p;
  };
  return {
    async put(key, bytes) {
      await mkdir(path.dirname(file(key)), { recursive: true });
      await writeFile(file(key), bytes);
    },
    async signedUrl() {
      return null;
    },
    async get(key) {
      try {
        return new Uint8Array(await readFile(file(key)));
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw e;
      }
    },
    async delete(keys) {
      await Promise.all(keys.map((k) => rm(file(k), { force: true })));
    },
  };
}

type R2Config = { accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string };

/** A private R2 bucket. The SDK is loaded on first use, so dev and tests never import it. */
export function r2Store(cfg: R2Config): FigureStore {
  const sdk = async () => {
    const [s3, presigner] = await Promise.all([import("@aws-sdk/client-s3"), import("@aws-sdk/s3-request-presigner")]);
    const client = new s3.S3Client({
      region: "auto",
      endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
      // Only the checksums S3 requires: R2 doesn't take every default checksum newer SDKs send.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
    return { s3, presigner, client };
  };
  let loaded: ReturnType<typeof sdk> | undefined;
  const load = () => (loaded ??= sdk());

  return {
    async put(key, bytes, contentType) {
      const { s3, client } = await load();
      await client.send(new s3.PutObjectCommand({ Bucket: cfg.bucket, Key: key, Body: bytes, ContentType: contentType }));
    },
    async signedUrl(key) {
      const { s3, presigner, client } = await load();
      return presigner.getSignedUrl(client, new s3.GetObjectCommand({ Bucket: cfg.bucket, Key: key }), {
        expiresIn: SIGNED_URL_SECONDS,
      });
    },
    async get(key) {
      const { s3, client } = await load();
      try {
        const res = await client.send(new s3.GetObjectCommand({ Bucket: cfg.bucket, Key: key }));
        return res.Body ? await res.Body.transformToByteArray() : null;
      } catch (e) {
        if (e instanceof s3.NoSuchKey) return null;
        throw e;
      }
    },
    async delete(keys) {
      if (keys.length === 0) return;
      const { s3, client } = await load();
      // DeleteObjects takes up to 1000 keys per call.
      for (let i = 0; i < keys.length; i += 1000) {
        await client.send(
          new s3.DeleteObjectsCommand({
            Bucket: cfg.bucket,
            Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true },
          }),
        );
      }
    },
  };
}
