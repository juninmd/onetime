import { mkdirSync } from "node:fs";

// File-backed secret store. Values are OPAQUE ciphertext blobs — the server
// holds no key and cannot decrypt. Entries burn on read and expire by TTL.
export interface Secret {
  blob: string; // base64: iv || ciphertext, produced client-side
  expiresAt: number;
  viewsLeft: number;
}

const DATA_DIR = process.env.DATA_DIR ?? "data";
const FILE = `${DATA_DIR}/secrets.json`;

function randomId(): string {
  // 16 bytes -> url-safe base64, ~22 chars. Unguessable.
  const buf = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...buf)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export class SecretStore {
  private map = new Map<string, Secret>();

  constructor(private persist = true) {
    if (this.persist) {
      mkdirSync(DATA_DIR, { recursive: true });
      this.load();
    }
  }

  private async load(): Promise<void> {
    try {
      const raw = await Bun.file(FILE).json();
      this.map = new Map(Object.entries(raw));
      this.sweep();
    } catch {
      // fresh start
    }
  }

  private async flush(): Promise<void> {
    if (!this.persist) return;
    await Bun.write(FILE, JSON.stringify(Object.fromEntries(this.map)));
  }

  sweep(): number {
    const now = Date.now();
    let removed = 0;
    for (const [id, s] of this.map) {
      if (s.expiresAt <= now || s.viewsLeft <= 0) {
        this.map.delete(id);
        removed++;
      }
    }
    if (removed) void this.flush();
    return removed;
  }

  async create(blob: string, ttlSec: number, views: number): Promise<string> {
    const id = randomId();
    this.map.set(id, {
      blob,
      expiresAt: Date.now() + ttlSec * 1000,
      viewsLeft: Math.max(1, views),
    });
    await this.flush();
    return id;
  }

  // Returns the blob once, then decrements/burns. null when gone/expired.
  async consume(id: string): Promise<string | null> {
    const s = this.map.get(id);
    if (!s) return null;
    if (s.expiresAt <= Date.now()) {
      this.map.delete(id);
      await this.flush();
      return null;
    }
    s.viewsLeft -= 1;
    const blob = s.blob;
    if (s.viewsLeft <= 0) this.map.delete(id);
    await this.flush();
    return blob;
  }

  size(): number {
    return this.map.size;
  }
}
