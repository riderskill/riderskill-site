import fs from "fs";
import fetch from "node-fetch";

const clientId = process.env.TWITCH_CLIENT_ID;
const clientSecret = process.env.TWITCH_CLIENT_SECRET;
const userLogin = (process.env.TWITCH_USER_LOGIN || "riderskill").toLowerCase();

if (!clientId || !clientSecret || !userLogin) {
  console.error("❌ TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET / TWITCH_USER_LOGIN manquant.");
  process.exit(1);
}

async function getToken() {
  const r = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    { method: "POST" }
  );
  if (!r.ok) {
    console.error("❌ Token error:", await r.text());
    process.exit(1);
  }
  const j = await r.json();
  return j.access_token;
}

async function getUserId(token) {
  const r = await fetch(`https://api.twitch.tv/helix/users?login=${userLogin}`, {
    headers: { "Client-ID": clientId, Authorization: `Bearer ${token}` }
  });
  const j = await r.json();
  const id = j?.data?.[0]?.id;
  if (!id) {
    console.error("❌ User not found:", userLogin, j);
    process.exit(1);
  }
  return id;
}

async function getLatestClips(token, userId) {
  // récupère jusqu’à 100, on trie après par date
  const url = new URL("https://api.twitch.tv/helix/clips");
  url.searchParams.set("broadcaster_id", userId);
  url.searchParams.set("first", "100");

  const r = await fetch(url, {
    headers: { "Client-ID": clientId, Authorization: `Bearer ${token}` }
  });
  if (!r.ok) {
    console.error("❌ Clips error:", await r.text());
    process.exit(1);
  }
  const j = await r.json();
  const list = j.data || [];

  return list
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 6)
    .map(c => ({
      id: c.id,
      url: c.url,
      title: c.title,
      created_at: c.created_at,
      thumbnail_url: c.thumbnail_url,
      view_count: c.view_count
    }));
}

(async () => {
  const token = await getToken();
  const uid = await getUserId(token);
  const clips = await getLatestClips(token, uid);

  fs.writeFileSync("clips.json", JSON.stringify({ data: clips }, null, 2));
  console.log(`✅ clips.json mis à jour (${clips.length} clips – plus récents).`);
})();


