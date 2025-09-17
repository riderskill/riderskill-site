// .github/workflows/scripts/fetch_youtube_rss.mjs
// Node 20+ : on utilise fetch natif, aucune dépendance externe.
import fs from "fs";

const CHANNEL_ID = process.env.YOUTUBE_HANDLE || ""; // tu as mis UCXMAE... dans ce secret
if (!CHANNEL_ID) {
  console.error("❌ Secret YOUTUBE_HANDLE manquant (mets l'ID de chaîne YouTube, pas le @handle).");
  process.exit(1);
}

const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

function pick(s, start, end) {
  const i = s.indexOf(start);
  if (i === -1) return "";
  const j = s.indexOf(end, i + start.length);
  return j === -1 ? "" : s.slice(i + start.length, j);
}

function parseEntries(xml) {
  const entries = [];
  const parts = xml.split("<entry>").slice(1); // chaque bloc entry
  for (const partRaw of parts) {
    const part = partRaw.split("</entry>")[0];

    // champs basiques
    const videoId = pick(part, "<yt:videoId>", "</yt:videoId>").trim();
    const title   = pick(part, "<title>", "</title>").trim();
    const published = pick(part, "<published>", "</published>").trim();

    // link rel="alternate" href="..."
    let url = "";
    const linkPos = part.indexOf('<link rel="alternate"');
    if (linkPos !== -1) {
      const hrefPos = part.indexOf('href="', linkPos);
      if (hrefPos !== -1) {
        const hrefEnd = part.indexOf('"', hrefPos + 6);
        if (hrefEnd !== -1) url = part.slice(hrefPos + 6, hrefEnd);
      }
    }
    if (!url && videoId) url = `https://www.youtube.com/watch?v=${videoId}`;

    // miniature <media:thumbnail url="...">
    let thumbnail = "";
    const thumbPos = part.indexOf('<media:thumbnail');
    if (thumbPos !== -1) {
      const uPos = part.indexOf('url="', thumbPos);
      if (uPos !== -1) {
        const uEnd = part.indexOf('"', uPos + 5);
        if (uEnd !== -1) thumbnail = part.slice(uPos + 5, uEnd);
      }
    }

    if (videoId && title) {
      entries.push({
        id: videoId,
        title,
        url,
        published_at: published,
        // ces clés sont lues par ton index :
        cover: thumbnail,
        thumbnail
      });
    }
  }
  return entries;
}

try {
  const res = await fetch(rssUrl, { headers: { "User-Agent": "curl/8" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();

  const items = parseEntries(xml);

  fs.mkdirSync("data", { recursive: true });
  const out = { updated_at: new Date().toISOString(), items };
  fs.writeFileSync("data/youtube.json", JSON.stringify(out, null, 2));
  console.log(`✅ data/youtube.json écrit (${items.length} vidéos).`);
} catch (e) {
  console.error("❌ Erreur YouTube RSS:", e);
  process.exit(1);
}

