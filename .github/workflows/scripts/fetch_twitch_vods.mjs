// .github/workflows/scripts/fetch_twitch_vods.mjs
import fs from "fs";

const clientId = process.env.TWITCH_CLIENT_ID;
const clientSecret = process.env.TWITCH_CLIENT_SECRET;
const userLogin = process.env.TWITCH_USER_LOGIN;

if (!clientId || !clientSecret || !userLogin) {
  console.error("❌ Erreur : Variables manquantes (TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, TWITCH_USER_LOGIN)");
  process.exit(1);
}

// Obtenir un token OAuth depuis Twitch
async function getToken() {
  const res = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`, {
    method: "POST"
  });
  const data = await res.json();
  return data.access_token;
}

// Récupérer l’ID utilisateur à partir du login
async function getUserId(token) {
  const res = await fetch(`https://api.twitch.tv/helix/users?login=${userLogin}`, {
    headers: { "Client-ID": clientId, "Authorization": `Bearer ${token}` }
  });
  const data = await res.json();
  if (!data.data || !data.data.length) throw new Error("Utilisateur introuvable");
  return data.data[0].id;
}

// Récupérer les VOD récentes
async function getVideos(userId, token) {
  const res = await fetch(`https://api.twitch.tv/helix/videos?user_id=${userId}&type=archive&first=5`, {
    headers: { "Client-ID": clientId, "Authorization": `Bearer ${token}` }
  });
  const data = await res.json();
  return data.data || [];
}

const token = await getToken();
const userId = await getUserId(token);
const videos = await getVideos(userId, token);

const out = videos.map(v => ({
  id: v.id,
  url: v.url,
  title: v.title,
  published_at: v.published_at,
  thumbnail_url: v.thumbnail_url
}));

fs.writeFileSync("vod.json", JSON.stringify(out, null, 2));
console.log(`✅ ${out.length} VOD mises à jour dans vod.json`);
