// .github/workflows/scripts/fetch_youtube_rss.mjs
import fs from "fs";
import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";

const handle = process.env.YOUTUBE_HANDLE; // ex: "riderskill"
if (!handle) {
  console.error("❌ Aucun YOUTUBE_HANDLE fourni.");
  process.exit(1);
}

const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${handle}`;

try {
  const res = await fetch(rssUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();

  const parsed = await parseStringPromise(xml, { explicitArray: false });

  const items = (parsed.feed.entry || []).map(v => ({
    id: v["yt:videoId"],
    title: v.title,
    url: v.link?.["@"].href || `https://www.youtube.com/watch?v=${v["yt:videoId"]}`,
    published_at: v.published,
    stats: {
      views: v["media:group"]?.["media:community"]?.["media:statistics"]?.views || 0,
    },
  }));

  const out = { updated_at: new Date().toISOString(), items };
  fs.writeFileSync("data/youtube.json", JSON.stringify(out, null, 2));
  console.log("✅ Fichier data/youtube.json mis à jour.");
} catch (e) {
  console.error("Erreur fetch YouTube RSS:", e);
  process.exit(1);
}

