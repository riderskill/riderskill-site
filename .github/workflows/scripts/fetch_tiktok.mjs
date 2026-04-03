import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// On force ton SEC_UID pour éviter les erreurs de détection
const SEC_UID = "MS4wLjABAAAA98XyvM8Q3G3YxW_H-k7X-B1O5N4-o2_YpL-nU9Y7Z8"; 
const USERNAME = "riderskill_twitch"; 

const MIRRORS = [
    "https://www.tikwm.com",
    "https://tikwm.leweiyun.top",
    "https://tikwm.com"
];

async function jsonGet(url) {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await res.json().catch(() => null);
    return data;
}

function writeOut(items) {
    const outDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
        path.join(outDir, "tiktok.json"),
        JSON.stringify({ updated_at: new Date().toISOString(), items }, null, 2)
    );
}

(async () => {
    for (const base of MIRRORS) {
        try {
            console.log(`Tentative via ${base}...`);
            // On utilise directement le SEC_UID forcé
            const url = `${base}/api/user/posts?sec_uid=${SEC_UID}&count=15`;
            const data = await jsonGet(url);
            
            if (data?.data?.videos?.length) {
                const items = data.data.videos.map(v => ({
                    id: v.video_id,
                    desc: v.title || "",
                    cover: v.origin_cover || v.cover,
                    play: v.play_addr || v.play,
                    create_time: v.create_time || 0
                }));
                
                console.log(`✅ Succès ! ${items.length} vidéos trouvées.`);
                writeOut(items);
                process.exit(0);
            }
        } catch (e) {
            console.warn(`⚠️ Échec miroir : ${e.message}`);
        }
    }
    console.error("❌ Impossible d'extraire les vidéos TikTok.");
    process.exit(1);
})();




