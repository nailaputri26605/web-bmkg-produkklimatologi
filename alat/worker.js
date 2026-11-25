// Cloudflare Worker sebagai perantara CORS untuk API resmi BMKG.
// Setelah deploy, isi BMKG_WORKER di script.js dengan URL Worker ini.
// Route yang didukung:
//   /cuaca?adm4=31.71.03.1001
//   /peringatan
//   /gempa/autogempa.json
//   /gempa/gempaterkini.json
//   /gempa/gempadirasakan.json
const BMKG_CUACA = "https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=";
const BMKG_GEMPA = "https://data.bmkg.go.id/DataMKG/TEWS/";
const BMKG_ALERT = "https://www.bmkg.go.id/alerts/nowcast/id";
const CACHE_DETIK = 900;

export default {
  async fetch(request, env, ctx) {
    const cors = {
      "Access-Control-Allow-Origin": env.ALLOW_ORIGIN || "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    const reply = (body, status, type) => new Response(body, {
      status: status || 200,
      headers: { ...cors, "Content-Type": type || "application/json; charset=utf-8", "Cache-Control": "public, max-age=" + CACHE_DETIK },
    });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "GET") return reply(JSON.stringify({ error: "method tidak didukung" }), 405);

    const url = new URL(request.url);
    let target = "";
    let type = "application/json; charset=utf-8";
    if (url.pathname === "/cuaca") {
      const adm4 = url.searchParams.get("adm4") || "";
      if (!/^\d{2}\.\d{2}\.\d{2}\.\d{4}$/.test(adm4)) return reply(JSON.stringify({ error: "kode wilayah adm4 tidak valid" }), 400);
      target = BMKG_CUACA + encodeURIComponent(adm4);
    } else if (url.pathname === "/peringatan") {
      target = BMKG_ALERT;
      type = "application/xml; charset=utf-8";
    } else if (url.pathname === "/gempa/autogempa.json" || url.pathname === "/gempa/gempaterkini.json" || url.pathname === "/gempa/gempadirasakan.json") {
      target = BMKG_GEMPA + url.pathname.split("/").pop();
    } else {
      return reply(JSON.stringify({ error: "route tidak ditemukan" }), 404);
    }

    try {
      const upstream = await fetch(target, { headers: { "User-Agent": "BMKG-Info-Static-Website/1.0" } });
      if (!upstream.ok) return reply(JSON.stringify({ error: "BMKG membalas HTTP " + upstream.status }), 502);
      return reply(await upstream.text(), 200, type);
    } catch (err) {
      return reply(JSON.stringify({ error: "Tidak dapat menghubungi layanan BMKG" }), 502);
    }
  },
};
