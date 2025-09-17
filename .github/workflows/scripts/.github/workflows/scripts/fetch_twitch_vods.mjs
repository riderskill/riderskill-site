// .github/workflows/scripts/fetch_twitch_vods.mjs
import fs from "fs";
import fetch from "node-fetch";

const clientId = process.env.TWITCH_CLIENT_ID;
const accessToken = process.env.TWITCH_ACCESS_TOKEN;
const userLogin = "riderskill"; // ton pseudo Twitch

async function fetchTwitchUserId() {
  const res = await fetch(`https://api.twitch.tv/helix/users?login=${userLogin}`, {
    headers: {
      "Client-ID": clientId,
      "Authorization": `Bearer ${accessToken}`,
    },
  });
  const data = await res.json();
  if (!data.data?.length) throw new Error("Utilisateur Twitch introuvable");
  return data.data[0].id;
}

async function fetchVods(userId) {
  const res = await fetch(`https://api.twitch.tv/helix/videos?user_id=${userId}&first=5&type=archive`, {
    headers: {
      "Client-ID": clientId,
      "Authorization": `Bearer ${accessToken}`,
    },
  });
  const data = await res.json();
  return data.data.map(v => ({
    id: v.id,
    url: v.url,
    title: v.title,
    thumbnail_url: v.thumbnail_url,
    published_at: v.published_at,
    duration: v.duration,
  }));
}

async function main() {
  try {
    const userId = await fetchTwitchUserId();
    const vods = await fetchVods(userId);

    fs.writeFileSync("vod.json", JSON.stringify(vods, null, 2));
    console.log("✅ vod.json mis à jour avec", vods.length, "VODs");
  } catch (err) {
    console.error("❌ Erreur fetch_twitch_vods:", err.message);
    process.exit(1);
  }
}

main();
