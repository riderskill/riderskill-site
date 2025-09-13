import fs from "fs";
import fetch from "node-fetch";

const clientId = process.env.TWITCH_CLIENT_ID;
const clientSecret = process.env.TWITCH_CLIENT_SECRET;
const userLogin = process.env.TWITCH_USER_LOGIN;

if (!clientId || !clientSecret || !userLogin) {
  console.error("❌ Variables manquantes : TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET ou TWITCH_USER_LOGIN.");
  process.exit(1);
}

async function getAccessToken() {
  const res = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`, {
    method: "POST"
  });
  if (!res.ok) {
    console.error("❌ Erreur récupération token Twitch", await res.text());
    process.exit(1);
  }
  const data = await res.json();
  return data.access_token;
}

async function getUserId(token) {
  const res = await fetch(`https://api.twitch.tv/helix/users?login=${userLogin}`, {
    headers: { "Client-ID": clientId, "Authorization": `Bearer ${token}` }
  });
  const data = await res.json();
  if (!data.data || data.data.length === 0) {
    console.error("❌ Impossible de trouver l’utilisateur Twitch :", userLogin);
    process.exit(1);
  }
  return data.data[0].id;
}

async function getClips(token, userId) {
  const res = await fetch(`https://api.twitch.tv/helix/clips?broadcaster_id=${userId}&first=5`, {
    headers: { "Client-ID": clientId, "Authorization": `Bearer ${token}` }
  });
  const data = await res.json();
  if (!data.data) {
    console.error("❌ Erreur récupération clips :", data);
    process.exit(1);
  }
  return data.data.map(c => ({
    id: c.id,
    url: c.url,
    title: c.title,
    created_at: c.created_at,
    thumbnail_url: c.thumbnail_url
  }));
}

(async () => {
  try {
    const token = await getAccessToken();
    const userId = await getUserId(token);
    const clips = await getClips(token, userId);

    fs.writeFileSync("clips.json", JSON.stringify(clips, null, 2));
    console.log("✅ Fichier clips.json mis à jour avec les 5 derniers clips.");
  } catch (err) {
    console.error("❌ Erreur:", err);
    process.exit(1);
  }
})();

