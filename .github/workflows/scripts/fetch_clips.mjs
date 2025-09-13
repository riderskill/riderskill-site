import fs from "fs";
import fetch from "node-fetch";

const clientId = process.env.TWITCH_CLIENT_ID;
const clientSecret = process.env.TWITCH_CLIENT_SECRET;
const userLogin = (process.env.TWITCH_USER_LOGIN || "riderskill").toLowerCase();

if (!clientId || !clientSecret || !userLogin) {
  console.error("❌ Variables manquantes.");
  process.exit(1);
}

const isoDaysAgo = (days) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
};

async function getAccessToken() {
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

async function fetchRecentClips(token, userId) {
  // Fenêtre récente = 90 jours pour être sûr d’en avoir 5
  const started_at = isoDaysAgo(90);

  // On récupère plus que 5, puis on trie par date
  const url = new URL("https://api.twitch.tv/helix/clips");
  url.searchParams.set("broadcaster_id", userId);
  url.searchParams.set("started_at", started_at);
  url.searchParams.set("first", "100");

  const headers = { "Client-ID": clientId, Authorization: `Bearer ${token}` };

  const res = await fetch(url, { headers });
  if (!res.ok) {
    console.error("❌ Clips error:", await res.text());
    process.exit(1);
  }
  const data = await res.json();
  const list = (data.data || []);

  // Tri par date DESC, puis on prend 5
  const recent = list
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5)
    .map(c => ({
      id: c.id,
      url: c.url,
      title: c.title,
      created_at: c.created_at,
      thumbnail_url: c.thumbnail_url,
      view_count: c.view_count
    }));

  return recent;
}

(async () => {
  try {
    const token = await getAccessToken();
    const userId = await getUserId(token);
    const clips = await fetchRecentClips(token, userId);

    fs.writeFileSync("clips.json", JSON.stringify(clips, null, 2));
    console.log(`✅ clips.json mis à jour (${clips.length} clips récents).`);
  } catch (e) {
    console.error("❌ Erreur:", e);
    process.exit(1);
  }
})();

