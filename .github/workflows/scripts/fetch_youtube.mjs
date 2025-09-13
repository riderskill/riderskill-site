import fs from "fs";
import fetch from "node-fetch";

const apiKey = process.env.YOUTUBE_API_KEY;
const channelId = process.env.YOUTUBE_CHANNEL_ID;

if (!apiKey || !channelId) {
  console.error("❌ YOUTUBE_API_KEY / YOUTUBE_CHANNEL_ID manquant.");
  process.exit(1);
}

const url = `https://www.googleapis.com/youtube/v3/search?key=${apiKey}&channelId=${channelId}&part=snippet&order=date&maxResults=6`;

const res = await fetch(url);
if (!res.ok) {
  console.error("❌ YouTube API error", await res.text());
  process.exit(1);
}
const json = await res.json();

const videos = (json.items || [])
  .filter(v => v.id?.kind === "youtube#video")
  .map(v => ({
    id: v.id.videoId,
    url: `https://www.youtube.com/watch?v=${v.id.videoId}`,
    title: v.snippet.title,
    published_at: v.snippet.publishedAt,
    thumbnail_url: v.snippet.thumbnails?.medium?.url || v.snippet.thumbnails?.high?.url
  }));

fs.writeFileSync("youtube.json", JSON.stringify({ data: videos.slice(0, 6) }, null, 2));
console.log("✅ youtube.json updated with 6 latest videos");
