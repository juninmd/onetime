import { Hono } from "hono";
import { SecretStore } from "./store";
import { createHtml, readerHtml } from "./pages";

const store = new SecretStore();
const MAX_BLOB = Number(process.env.MAX_BLOB_BYTES ?? 64 * 1024); // 64 KiB ciphertext cap
const MAX_TTL = Number(process.env.MAX_TTL_SEC ?? 7 * 86400);

const app = new Hono();

// Secrets must never be cached, framed or leak through referrers.
app.use("*", async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
  c.header("Referrer-Policy", "no-referrer");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
});

app.get("/", (c) => c.html(createHtml));
app.get("/s/:id", (c) => c.html(readerHtml));

app.post("/api/secret", async (c) => {
  const body = await c.req.json().catch(() => null);
  const blob = body?.blob;
  if (typeof blob !== "string" || blob.length === 0) return c.json({ error: "blob required" }, 400);
  if (blob.length > MAX_BLOB) return c.json({ error: "too large" }, 413);
  const ttlSec = Math.min(Math.max(Number(body?.ttlSec) || 3600, 1), MAX_TTL);
  const views = Math.min(Math.max(Math.floor(Number(body?.views)) || 1, 1), 10);
  const id = await store.create(blob, ttlSec, views);
  return c.json({ id });
});

app.get("/api/secret/:id", async (c) => {
  const blob = await store.consume(c.req.param("id"));
  if (blob === null) return c.json({ error: "gone" }, 404);
  return c.json({ blob });
});

app.get("/health", (c) => c.json({ ok: true, stored: store.size() }));

if (import.meta.main) {
  // Periodic TTL sweep.
  setInterval(() => store.sweep(), 60_000);
  const port = Number(process.env.PORT ?? 3000);
  console.log(`onetime on :${port}`);
  Bun.serve({ port, fetch: app.fetch });
}

export { app, store };
