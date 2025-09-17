// fetch_tiktok.mjs — version SANS RapidAPI
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USERNAME = (process.env.TIKTOK_USERNAME || "").trim();
if (!USERNAME) {
  console.error("❌ TIKTOK_USERNAME manquant (ex: riderskill_twitch).");
  process.exit(1);
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      // On se fait passer pour un vrai navigateur pour éviter le blocage
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9,fr;q=0.8",
      "Referer": "https://www.google.com/"
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

function extractSigiState(html) {
  // 1) format script tag
  let m = html.match(
    /<script id="SIGI_STATE" type="application\/json">(.*?)<\/script>/s
  );
  if (m) return JSON.parse(m[1]);

  // 2) format window['SIGI_STATE'] = {...};
  m = html.match(/window\['SIGI_STATE'\]\s*=\s*(\{.+?\});/s);
  if (m) return JSON.parse(m[1]);

  throw new Error("SIGI_STATE introuvable dans la page TikTok.");
}

function normalizeFromItemModule(state) {
  const itemsObj = state?.ItemModule || {};
  const items = Object.values(itemsObj);
  return items.map((it) => {
    const id = String(it?.id ?? "");
    const desc = it?.desc ?? "";
    const create_time = it?.createTime ? Number(it.createTime) : null;

    // Vidéo / covers
    const cover =
      it?.video?.cover ?? it?.video?.originCover ?? it?.video?.dynamicCover ?? null;
    const play =
      it?.video?.playAddr ??
      it?.video?.downloadAddr ??
      it?.video?.bitrateInfo?.[0]?.PlayAddr?.urlList?.[0] ??
      null;

    const s = it?.stats || {};
    return {
      id,
      desc,
      cover,
      play,
      create_time,
      stats: {
        digg_count: s.diggCount ?? null,
        comment_count: s.commentCount ?? null,
        share_count: s.shareCount ?? null,
        play_count: s.playCount ?? null,
        collect_count: s.collectCount ?? null
      }
    };
  });
}

(async () => {
  try {
    const url = `https://www.tiktok.com/@${USERNAME}`;
    console.log(`ℹ️ Fetch ${url}`);
    const html = await fetchHtml(url);
    const state = extractSigiState(html);
    const list = normalizeFromItemModule(state);

    if (!list.length) {
      console.warn("⚠️ Aucune vidéo détectée dans ItemModule.");
    }

    const outDir = path.join(process.cwd(), "data");
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, "tiktok.json");
    fs.writeFileSync(
      outFile,
      JSON.stringify({ updated_at: new Date().toISOString(), items: list }, null, 2)
    );
    console.log(`✅ ${list.length} vidéos écrites dans data/tiktok.json`);
    process.exit(0);
  } catch (e) {
    console.error("❌ Erreur:", e.message);
    process.exit(1);
  }
})();


