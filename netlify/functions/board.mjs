// Shared group board for /ai-2030/ (and future explorables that need one).
// Storage: Netlify Blobs, one JSON blob per participant, keyed "<room>/<name>".
// API (Functions 2.0, routed to /api/board):
//   GET    /api/board?room=main   -> { people: [{name, vals, conf, t}, ...] }
//   POST   /api/board?room=main   -> body {name, vals[6] 1-5, conf[5] 0-100 summing 0|100}
//   DELETE /api/board?room=main   -> wipe the room
import { getStore } from "@netlify/blobs";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export default async (req) => {
  const store = getStore("ai2030-boards");
  const url = new URL(req.url);
  const room =
    (url.searchParams.get("room") || "main")
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "")
      .slice(0, 32) || "main";

  if (req.method === "GET") {
    const { blobs } = await store.list({ prefix: room + "/" });
    const people = (
      await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })))
    )
      .filter(Boolean)
      .sort((a, b) => (a.t || 0) - (b.t || 0));
    return json({ people });
  }

  if (req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch {
      return json({ error: "bad json" }, 400);
    }
    const name = String(body.name || "").trim().slice(0, 24);
    const vals = Array.isArray(body.vals) ? body.vals.map(Number) : [];
    const conf = Array.isArray(body.conf) ? body.conf.map(Number) : [];
    const total = conf.reduce((a, b) => a + b, 0);
    if (!name) return json({ error: "name required" }, 400);
    if (vals.length !== 6 || vals.some((v) => !(v >= 1 && v <= 5)))
      return json({ error: "vals must be six numbers 1-5" }, 400);
    if (
      conf.length !== 5 ||
      conf.some((v) => !(v >= 0 && v <= 100)) ||
      (total !== 0 && total !== 100)
    )
      return json({ error: "confidence must total 0 or 100" }, 400);
    await store.setJSON(room + "/" + name.toLowerCase(), {
      name,
      vals,
      conf,
      t: Date.now(),
    });
    return json({ ok: true });
  }

  if (req.method === "DELETE") {
    const { blobs } = await store.list({ prefix: room + "/" });
    await Promise.all(blobs.map((b) => store.delete(b.key)));
    return json({ ok: true, cleared: blobs.length });
  }

  return json({ error: "method not allowed" }, 405);
};

export const config = { path: "/api/board" };
