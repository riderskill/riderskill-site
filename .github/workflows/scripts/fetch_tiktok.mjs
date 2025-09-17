// fetch_tiktok.mjs — robust: TikTok -> r.jina.ai proxy -> vxtiktok JSON
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USERNAME = (process.env.TIKTOK_USERNAME || "").trim();
if (!USERNAME) { console.error("❌ TIKTOK_USERNAME manquant (ex: riderskill_twitch)"); process.exit(1); }

async function httpGet(url, headers = {}) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.9,*/*;q=0.8",
      "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      ...headers
    }
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

function extractSIGI(html) {
  let m = html.match(/<script id="SIGI_STATE" type="application\/json">(.*?)<\/script>/s);
  if (m) return JSON.parse(m[1]);
  m = html.match(/window\['SIGI_STATE'\]\s*=\s*(\{.+?\});/s);
  if (m) return JSON.parse(m[1]);
  return null;
}

function normalizeFromSIGI(state) {
  const items = Object.values(state?.ItemModule || {});
  return items.map(it => ({
    id: String(it?.id ?? ""),
    desc: it?.desc ?? "",
    cover: it?.video?.cover ?? it?.video?.originCover ?? null,
    play: it?.video?.playAddr ?? it?.video?.downloadAddr ?? null,
    create_time: it?.createTime ? Number(it.createTime) : null,
    stats: {
      digg_count: it?.stats?.diggCount ?? null,
      comment_count: it?.stats?.commentCount ?? null,
      share_count: it?.stats?.shareCount ?? null,
      play_count: it?.stats?.playCount ?? null
    }
  }));
}

// Fallback vxtiktok (pas de clé)
async function fetchViaVxTikTok(username) {
  const urls = [
    `https://vxtiktok.com/api/user/${encodeURIComponent(username)}?full=1`,
    `https://vxtiktok.com/api/user/${encodeURIComponent(username)}`
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!res.ok) continue;
      const data = await res.json().catch(() => null);
      if (!data) continue;

      // vxtiktok renvoie souvent { videos: [ ... ] } ou { data: { videos: [...] } }
      const vids = data?.videos || data?.data?.videos || [];
      if (!Array.isArray(vids) || vids.length === 0) continue;

      return vids.map(v => ({
        id: String(v?.id ?? v?.video_id ?? ""),
        desc: v?.title ?? v?.desc ?? "",
        cover: v?.cover ?? v?.cover_url ?? v?.origin_cover ?? null,
        play: v?.play ?? v?.play_url ?? v?.download_url ?? null,
        create_time: v?.create_time ? Number(v.create_time) : null,
        stats: {
          digg_count: v?.digg_count ?? v?.likes ?? null,
          comment_count: v?.comment_count ?? null,
          share_count: v?.share_count ?? null,
          play_count: v?.play_count ?? v?.views ?? null
        }
      }));
    } catch { /* try next */ }
  }
  return [];
}

function writeOut(items) {
  const outDir = path.join(process.cwd(), "data");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "tiktok.json"),
    JSON.stringify({ updated_at: new Date().toISOString(), items }, null, 2)
  );
}

(async () => {
  try {
    // 1) TikTok direct (plusieurs variantes)
    const directUrls = [
      `https://www.tiktok.com/@${USERNAME}?lang=en`,
      `https://www.tiktok.com/@${USERNAME}`,
    ];
    for (const u of directUrls) {
      const { ok, status, text } = await httpGet(u, { Referer: "https://www.google.com/" });
      if (!ok) continue;
      const sigi = extractSIGI(text);
      if (sigi) {
        const items = normalizeFromSIGI(sigi);
        if (items.length) {
          console.log(`✅ Trouvé via TikTok direct (${u}) — ${items.length} vidéos`);
          writeOut(items);
          return process.exit(0);
        }
      }
    }

    // 2) Proxy r.jina.ai (retourne la page rendue en texte)
    const proxyUrls = [
      `https://r.jina.ai/http://www.tiktok.com/@${USERNAME}`,
      `https://r.jina.ai/https://www.tiktok.com/@${USERNAME}`
    ];
    for (const u of proxyUrls) {
      const { ok, text } = await httpGet(u);
      if (!ok) continue;
      const sigi = extractSIGI(text);
      if (sigi) {
        const items = normalizeFromSIGI(sigi);
        if (items.length) {
          console.log(`✅ Trouvé via proxy (${u}) — ${items.length} vidéos`);
          writeOut(items);
          return process.exit(0);
        }
      }
    }

    // 3) Fallback vxtiktok JSON
    const vxItems = await fetchViaVxTikTok(USERNAME);
    if (vxItems.length) {
      console.log(`✅ Trouvé via vxtiktok — ${vxItems.length} vidéos`);
      writeOut(vxItems);
      return process.exit(0);
    }

    console.error("❌ Impossible d’extraire des vidéos via TikTok, proxy ou vxtiktok.");
    process.exit(1);
  } catch (e) {
    console.error("❌ Erreur:", e.message);
    process.exit(1);
  }
})();



