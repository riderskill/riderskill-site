import fs from "fs";
import fetch from "node-fetch";

const apiKey = process.env.TIKTOK_API_KEY;
const username = process.env.TIKTOK_USER; // ex: riderskill_twitch

if (!apiKey || !username) {
  console.error("❌ TIKTOK_API_KEY / TIKTOK_USER manquant.");
  process.exit(1);
}

const res = await fetch(
  `https://tiktok-scraper2.p.rapidapi.com/user/posts?unique_id=${encodeURIComponent(username)}&count=6`,
  {
    headers: {
      "X-RapidAPI-Key": apiKey,
      "X-RapidAPI-Host": "tiktok-scraper2.p.rapidapi.com"
    }
  }
);

if (!res.ok) {
  console.error("❌ TikTok API error", await res.text());
  process.exit(1);
}

const json = await res.json();
const items = json?.data?.videos || [];

const videos = items.slice(0, 6).map(v => ({
  id: v.id,
  url: v.play,
  title: v.title || "TikTok",
  created_at: v.create_time,
  thumbnail_url: v.cover
}));

fs.writeFileSync("tiktok.json", JSON.stringify({ data: videos }, null, 2));
console.log("✅ tiktok.json updated with 6 latest TikTok videos");
