import fs from "fs";
import fetch from "node-fetch";

const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const USER_LOGIN = process.env.TWITCH_USER_LOGIN || "riderskill";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Missing Twitch secrets.");
  process.exit(1);
}

async function getAppToken() {
  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=client_credentials`,
    { method: "POST" }
  );
  if (!res.ok) throw new Error("Token error");
  return res.json();
}

async function getUserId(token) {
  const res = await fetch(
    `https://api.twitch.tv/helix/users?login=${encodeURIComponent(USER_LOGIN)}`,
    { headers: { "Client-ID": CLIENT_ID, Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  const id = data?.data?.[0]?.id;
  if (!id) throw new Error("User not found");
  return id;
}

function isoDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

async function getClips(token, userId) {
  const started_at = isoDaysAgo(90); // 90 jours pour garantir 5 clips
  const url = new URL("https://api.twitch.tv/helix/clips");
  url.searchParams.set("broadcaster_id", userId);
  url.searchParams.set("started_at", started_at);
  url.searchParams.set("first", "50");

  const res = await fetch(url, {
    headers: { "Client-ID": CLIENT_ID, Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Clips error: ${res.status} ${t}`);
  }
  const data = await res.json();

  const sorted = (data.data || [])
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

  return sorted;
}

(async () => {
  try {
    const { access_token } = await getAppToken();
    const uid = await getUserId(access_token);
    const clips = await getClips(access_token, uid);

    const out = {
      data: clips.map((c) => ({
        id: c.id,
        url: c.url,
        title: c.title,
        created_at: c.created_at,
        view_count: c.view_count,
        thumbnail_url: c.thumbnail_url
      }))
    };

    fs.writeFileSync("clips.json", JSON.stringify(out, null, 2));
    console.log("clips.json written with", out.data.length, "clips");
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
