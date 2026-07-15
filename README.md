# 🔐 onetime

Zero-knowledge **one-time secret sharing**. Encrypt a password/token/note in your browser, share a self-destructing link, and the recipient reads it exactly once. The server stores only ciphertext and **never sees the key** — it travels in the URL fragment (`#`), which browsers never send to the server.

Think PrivateBin / One-Time-Secret, ~150 LOC, self-hosted.

## How it works
1. Browser generates an AES-GCM-256 key, encrypts the text, uploads `iv || ciphertext`.
2. Server returns an id; the link is `/s/<id>#<key>`.
3. Reader loads the page, pulls the key from `#`, fetches the blob, decrypts locally.
4. On fetch the server **decrements views and burns** the record. TTL sweep removes the rest.

The server is a dumb ciphertext vault: a DB leak reveals nothing without the fragment keys, which it never had.

## Run
```bash
bun install && bun start   # http://localhost:3000
bun test
```

## Config (env)
| var | default | meaning |
|-----|---------|---------|
| `MAX_BLOB_BYTES` | `65536` | ciphertext size cap |
| `MAX_TTL_SEC` | `604800` | max lifetime (7d) |
| `DATA_DIR` | `data` | JSON persistence dir (PVC in prod) |

## API
- `POST /api/secret` `{blob, ttlSec, views}` → `{id}`
- `GET /api/secret/:id` → `{blob}` (burns a view)
- `GET /health`

## Deploy
GHCR `ghcr.io/juninmd/onetime:latest` → ArgoCD `app-charts/onetime` → `https://onetime.antonio-code.duckdns.org`. Needs a small PVC for `data/`.

MIT.
