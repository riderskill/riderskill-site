import fs from "fs";
import fetch from "node-fetch";

const apiKey = process.env.TIKTOK_API_KEY;        // secret que tu as déjà
const username = process.env.TIKTOK_USERNAME;     // secret que tu as déjà

if (!apiKey || !username) {
  console.error("❌ Manque TIKTOK_API_KEY / TIKTOK_USERNAME.");
  process.exit(1);
}

async function run() {
  // Endpoint RapidAPI (TikTok-API23). Selon l’API, "unique_id" peut être "uniqueId".
  const url = `https://tiktok-api23.p.rapidapi.com/api/user/posts?unique_id=${encodeURIComponent(username)}&count=24`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "x-rapidapi-key": apiKey,
      "x-rapidapi-host": "tiktok-api23.p.rapidapi.com",
    },
  });

  if (!res.ok) {
    console.error("❌ TikTok API error:", await res.text());
    process.exit(1);
  }

  const json = await res.json();
  const raw = json?.data?.videos || json?.data || json?.videos || [];

  const six = raw
    .sort((a, b) => Number(b.createTime || 0) - Number(a.createTime || 0))
    .slice(0, 6)
    .map(v => ({
      id: v.id,
      url: `https://www.tiktok.com/@${username}/video/${v.id}`,
      title: v.desc || v.title || "TikTok",
      created_at: v.createTime ? new Date(Number(v.createTime) * 1000).toISOString() : null,
      thumbnail_url: v.cover || v.originCover || v.dynamicCover || v?.video?.cover || "",
      view_count: v.stats?.playCount ?? null,
    }));

  fs.writeFileSync("tiktok.json", JSON.stringify({ data: six }, null, 2));
  console.log(`✅ tiktok.json mis à jour (${six.length} vidéos).`);
}

run().catch(err => {
  console.error("❌ Erreur:", err);
  process.exit(1);
});
