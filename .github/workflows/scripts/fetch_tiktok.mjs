import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const SECUID = process.env.TIKTOK_SECUID?.trim();
const USERNAME = process.env.TIKTOK_USERNAME?.trim();

if (!RAPIDAPI_KEY) { console.error("❌ RAPIDAPI_KEY manquant"); process.exit(1); }

const HOSTS = [
  { host: "tiktok85.p.rapidapi.com", userPosts: "/api/user/posts", userInfo: "/api/user/info" },
  { host: "tiktok-api23.p.rapidapi.com", userPosts: "/api/user/posts", userInfo: "/api/user/info" },
  { host: "tiktok-scraper7.p.rapidapi.com", userPosts: "/user/posts", userInfo: "/user/info" },
];

async function call(host, path, params) {
  const url = new URL(`https://${host}${path}`);
  Object.entries(params||{}).forEach(([k,v])=>v&&url.searchParams.set(k,v));
  const res = await fetch(url, { headers: { "X-RapidAPI-Key": RAPIDAPI_KEY, "X-RapidAPI-Host": host }});
  const text = await res.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(`${host}${path} -> ${res.status} ${typeof data==="string"?data:JSON.stringify(data)}`);
  return data;
}

async function resolveSecUid() {
  if (SECUID) return SECUID;
  if (!USERNAME) return null;
  for (const h of HOSTS) {
    try {
      const d = await call(h.host, h.userInfo, { unique_id: USERNAME, username: USERNAME });
      const sec = d?.data?.sec_uid || d?.user?.sec_uid || d?.sec_uid || d?.userInfo?.sec_uid || d?.secUid;
      if (sec) return sec;
    } catch { /* next host */ }
  }
  return null;
}

function normalize(listWrapper) {
  const items = listWrapper?.data?.aweme_list || listWrapper?.aweme_list || listWrapper?.data?.posts || listWrapper?.posts || [];
  return items.map(it => {
    const id = it?.aweme_id || it?.id || it?.awemeId || it?.video_id || "";
    const desc = it?.desc || it?.title || it?.share_info?.share_title || "";
    const cover = it?.video?.cover?.url_list?.[0] || it?.video?.origin_cover?.url_list?.[0] || it?.cover || it?.cover_url || null;
    const play = it?.video?.play_addr?.url_list?.[0] || it?.video?.download_addr?.url_list?.[0] || it?.play || null;
    const ct = it?.create_time || it?.createTime || it?.timestamp || null;
    const s = it?.statistics || it?.stats || {};
    return {
      id: String(id), desc, cover, play, create_time: ct?Number(ct):null,
      stats: {
        digg_count: s.digg_count ?? null,
        comment_count: s.comment_count ?? null,
        share_count: s.share_count ?? null,
        play_count: s.play_count ?? null,
        collect_count: s.collect_count ?? null,
      },
    };
  });
}

(async () => {
  const sec = await resolveSecUid();
  if (!sec) { console.error("❌ Pas de sec_uid (donne TIKTOK_USERNAME ou TIKTOK_SECUID)"); process.exit(1); }

  let lastErr = null;
  for (const h of HOSTS) {
    try {
      const data = await call(h.host, h.userPosts, { sec_uid: sec, secUid: sec, count: "24" });
      const list = normalize(data);
      if (!list.length) throw new Error("Réponse vide (aucune vidéo)");
      const outDir = path.join(process.cwd(), "data"); fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir,"tiktok.json"), JSON.stringify({ updated_at: new Date().toISOString(), items: list }, null, 2));
      console.log(`✅ ${list.length} vidéos écrites dans data/tiktok.json via ${h.host}`);
      process.exit(0);
    } catch (e) { console.warn(`⚠️ ${h.host}: ${e.message}`); lastErr = e; }
  }
  console.error("❌ Impossible de récupérer les posts sur tous les endpoints."); if (lastErr) console.error(String(lastErr)); process.exit(1);
})();

