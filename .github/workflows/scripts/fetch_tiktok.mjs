import fs from "fs";
import fetch from "node-fetch";

const apiKey = process.env.TIKTOK_API_KEY;
const username = process.env.TIKTOK_USERNAME;

if (!apiKey || !username) {
  console.error("❌ Manque TIKTOK_API_KEY ou TIKTOK_USERNAME.");
  process.exit(1);
}

const HEADERS = {
  "x-rapidapi-key": apiKey,
  "x-rapidapi-host": "tiktok-api23.p.rapidapi.com",
};

/**
 * Certaines versions de l’API "tiktok-api23" exposent des endpoints différents :
 * - /api/user/posts?unique_id=
 * - /api/user/posts?uniqueId=
 * - /user/posts?unique_id=
 * - /user/posts?uniqueId=
 * On essaie tous dans l’ordre jusqu’à ce que l’un réponde correctement.
 */
const CANDIDATE_URLS = [
  `https://tiktok-api23.p.rapidapi.com/api/user/posts?unique_id=${encodeURIComponent(username)}&count=24`,
  `https://tiktok-api23.p.rapidapi.com/api/user/posts?uniqueId=${encodeURIComponent(username)}&count=24`,
  `https://tiktok-api23.p.rapidapi.com/user/posts?unique_id=${encodeURIComponent(username)}&count=24`,
  `https://tiktok-api23.p.rapidapi.com/user/posts?uniqueId=${encodeURIComponent(username)}&count=24`,
];

async function tryFetch(url) {
  console.log("🔎 Test endpoint:", url);
  const res = await fetch(url, { headers: HEADERS });
  const text = await res.text();

  if (!res.ok) {
    console.error(`❌ ${res.status} ${res.statusText} ->`, text.slice(0, 500));
    return null;
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    console.error("❌ Réponse non-JSON:", text.slice(0, 500));
    return null;
  }
  return json;
}

function normalize(json) {
  // Selon l’API, la structure change. On tente plusieurs chemins.
  const raw =
    json?.data?.videos ||
    json?.data ||
    json?.videos ||
    json?.aweme_list ||
    [];

  // Normalisation -> 6 plus récentes
  const six = raw
    .sort((a, b) => Number(b.createTime || b.create_time || 0) - Number(a.createTime || a.create_time || 0))
    .slice(0, 6)
    .map((v) => {
      const id = v.id || v.aweme_id;
      const created = v.createTime || v.create_time;
      const thumb =
        v.cover ||
        v.originCover ||
        v.dynamicCover ||
        v?.video?.cover ||
        v?.video?.originCover ||
        v?.video?.dynamicCover ||
        "";

      const title = v.desc || v.title || v?.share_info?.share_title || "TikTok";
      const views =
        v?.stats?.playCount ??
        v?.statistics?.play_count ??
        null;

      return {
        id,
        url: id ? `https://www.tiktok.com/@${username}/video/${id}` : null,
        title,
        created_at: created ? new Date(Number(created) * 1000).toISOString() : null,
        thumbnail_url: thumb,
        view_count: views,
      };
    })
    .filter((x) => x.id && x.url);

  return six;
}

async function run() {
  let json = null;

  for (const url of CANDIDATE_URLS) {
    json = await tryFetch(url);
    if (json) break;
  }

  if (!json) {
    console.error("❌ Impossible d'obtenir les posts TikTok sur tous les endpoints testés.");
    process.exit(1);
  }

  const six = normalize(json);
  console.log(`✅ ${six.length} vidéo(s) trouvée(s).`);

  fs.writeFileSync("tiktok.json", JSON.stringify({ data: six }, null, 2));
  console.log("💾 tiktok.json écrit.");
}

run().catch((e) => {
  console.error("❌ Erreur fatale:", e);
  process.exit(1);
});

