// .github/workflows/scripts/fetch_youtube_rss.mjs
import fs from "fs";

// --- 1) Récupération du secret ---
// Tu peux mettre dans YOUTUBE_HANDLE soit:
//   - un handle:  "@riderskill"
//   - un channel id: "UCxxxxxxxxxxxx"
const input = (process.env.YOUTUBE_HANDLE || "").trim();
if (!input) {
  console.error("❌ Secret YOUTUBE_HANDLE manquant.");
  process.exit(1);
}

// --- 2) Résolution channelId si on te donne un @handle ---
async function resolveChannelId(from) {
  // Si c'est déjà un channelId (UC...), on le garde
  if (/^UC[0-9A-Za-z_-]{20,}$/.test(from)) return from;

  // Sinon on suppose un handle: @monhandle (ou "monhandle")
  const handle = from.startsWith("@") ? from : `@${from}`;
  const url = `https://www.youtube.com/${handle}`;

  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`Impossible de résoudre le handle (${res.status})`);
  const html = await res.text();

  // On chope "channelId":"UCxxxxxxxxxxxx"
  const m = html.match(/"channelId"\s*:\s*"([^"]+)"/);
  if (!m) throw new Error("channelId introuvable sur la page du handle.");
  return m[1];
}

// --- 3) Récupérer le flux RSS du channel ---
async function fetchRss(channelId) {
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  const res = await fetch(rssUrl);
  if (!res.ok) throw new Error(`RSS HTTP ${res.status}`);
  return await res.text();
}

// --- 4) Parser le minimum d'infos depuis le XML (sans lib) ---
function parseEntries(xml) {
  const entries = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let m;
  while ((m = entryRegex.exec(xml))) {
    const block = m[1];

    const get = (tag) => {
      const r = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`);
      const mm = r.exec(block);
      return mm ? mm[1].trim() : "";
    };

    const videoId = get("yt:videoId");
    const title = get("title");
    const published = get("published");

    // lien
    let url = "";
    const linkM = block.match(/<link[^>]+href="([^"]+)"/);
    if (linkM) url = linkM[1];
    if (!url && videoId) url = `https://www.youtube.com/watch?v=${videoId}`;

    entries.push({
      id: videoId,
      title,
      url,
      published_at: published,
      stats: { views: 0 }, // le RSS ne donne pas les vues
    });
  }
  return entries;
}

// --- 5) Orchestration ---
try {
  const channelId = await resolveChannelId(input);
  const xml = await fetchRss(channelId);
  const items = parseEntries(xml);

  const out = { updated_at: new Date().toISOString(), items };
  fs.writeFileSync("data/youtube.json", JSON.stringify(out, null, 2));
  console.log("✅ Fichier data/youtube.json mis à jour avec", items.length, "vidéos.");
} catch (e) {
  console.error("❌ Erreur YouTube:", e.message || e);
  process.exit(1);
}

