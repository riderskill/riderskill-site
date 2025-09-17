// fetch_tiktok.mjs — utilise l'API publique tikwm.com (pas de clé)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USERNAME = (process.env.TIKTOK_USERNAME || "").trim();
if (!USERNAME) {
  console.error("❌ TIKTOK_USERNAME manquant (ex: riderskill_twitch)");
  process.exit(1);
}

// quelques miroirs connus si le domaine principal rate
const MIRRORS = [
  "https://www.tikwm.com",
  "https://tikwm.leweiyun.top",
  "https://tikwm.com"
];

async function jsonGet(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new Error(`HTTP ${res.status}`);
  return data;
}

async function getSecUid(base) {
  // essaie de récupérer le sec_uid depuis /api/user/info
  const url = `${base}/api/user/info?unique_id=${encodeURIComponent(USERNAME)}`;
  const data = await jsonGet(url);
  const sec =
    data?.data?.sec_uid ||
    data?.data?.user?.sec_uid ||
    data?.sec_uid ||
    null;
  if (!sec) throw new Error("sec_uid introuvable");
  return sec;
}

function normalize(list) {
  return list.map(v => {
    const id = String(v?.aweme_id || v?.id || "");
    const desc = v?.title || v?.desc || "";
    const cover =
      v?.cover || v?.origin_cover || v?.video?.cover || null;
    const play =
      v?.play || v?.play_addr || v?.video?.play || null;
    const ct = Number(v?.create_time || v?.createTime || 0) || null;
    const s = v?.statistics || v?.stats || {};
    return {
      id,
      desc,
      cover,
      play,
      create_time: ct,
      stats: {
        digg_count: s.digg_count ?? v?.digg_count ?? v?.like ?? null,
        comment_count: s.comment_count ?? v?.comment_count ?? null,
        share_count: s.share_count ?? v?.share_count ?? null,
        play_count: s.play_count ?? v?.play_count ?? null,
        collect_count: s.collect_count ?? v?.collect_count ?? null
      }
    };
  });
}

function writeOut(items) {
  const outDir = path.join(process.cwd(), "data");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "tiktok.json"),
    JSON.stringify({ updated_at: new Date().toISOString(), items }, null, 2)
  );
}

(async () => {
  let lastErr = null;

  for (const base of MIRRORS) {
    try {
      // 1) posts direct par unique_id (certaines instances acceptent)
      try {
        const d1 = await jsonGet(`${base}/api/user/posts?unique_id=${encodeURIComponent(USERNAME)}&count=24`);
        const items1 = normalize(d1?.data?.videos || d1?.data || []);
        if (items1.length) {
          console.log(`✅ TikWM (unique_id) via ${base} — ${items1.length} vidéos`);
          writeOut(items1);
          return process.exit(0);
        }
      } catch(_) {/* on tente la suite */}

      // 2) sinon: récupérer sec_uid puis posts par sec_uid (méthode fiable)
      const sec = await getSecUid(base);
      const d2 = await jsonGet(`${base}/api/user/posts?sec_uid=${encodeURIComponent(sec)}&count=24`);
      const items2 = normalize(d2?.data?.videos || d2?.data || []);
      if (items2.length) {
        console.log(`✅ TikWM (sec_uid) via ${base} — ${items2.length} vidéos`);
        writeOut(items2);
        return process.exit(0);
      }

      lastErr = new Error("Réponse vide");
    } catch (e) {
      lastErr = e;
      console.warn(`⚠️ Echec via ${base



