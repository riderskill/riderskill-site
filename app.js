// ===== Badge ON/OFF =====
function setStatus(mode){
  const dot = document.getElementById('statusDot');
  const label = document.getElementById('brandText');
  if(!dot || !label) return;
  dot.classList.remove('live','off');
  label.classList.remove('on','off');
  if(mode==='on'){
    dot.classList.add('live'); label.classList.add('on'); label.textContent='RiderSkill ON';
  }else if(mode==='off'){
    dot.classList.add('off'); label.classList.add('off'); label.textContent='RiderSkill OFF';
  }else{
    label.textContent='RiderSkill';
  }
}
function hasStatusParam(){ return new URLSearchParams(location.search).has('live'); }
function initStatusFromUrl(){
  const p = new URLSearchParams(location.search).get('live');
  if(p==='1') setStatus('on');
  else if(p==='0') setStatus('off');
  else setStatus('unknown');
}

// ===== Admin toggle (clips page) =====
function showAdminIfNeeded(){
  const params = new URLSearchParams(location.search);
  if (params.get('admin') === '1') {
    const el = document.getElementById('adminLink');
    if (el) el.style.display = 'inline-flex';
  }
}

// ===== Clips page logic =====
async function initClipsPage(){
  try{
    const res = await fetch('clips.json', {cache:'no-store'});
    if(!res.ok) throw new Error('no clips.json');
    const clips = await res.json();

    // Albums
    const albums = [...new Set(clips.map(c => (c.album||'').trim()).filter(Boolean))];
    const sel = document.getElementById('albumFilter');
    if (sel) {
      albums.forEach(a => { const o=document.createElement('option'); o.value=a; o.textContent=a; sel.appendChild(o); });
    }

    function ytId(url){ const m = (url||'').match(/(?:youtu\.be\/|v=)([A-Za-z0-9_\-]{6,})/); return m ? m[1] : null; }
    function twitchClipSlug(url){
      const m1 = (url||'').match(/clips\.twitch\.tv\/([A-Za-z0-9\-]+)/);
      const m2 = (url||'').match(/[?&]clip=([A-Za-z0-9\-]+)/);
      return (m1 && m1[1]) || (m2 && m2[1]) || null;
    }

    function render(list){
      const grid = document.getElementById('clipsGrid');
      const empty = document.getElementById('clipsEmpty');
      if(!grid || !empty) return;
      grid.innerHTML = '';
      if(!list.length){ empty.style.display='block'; return; }
      empty.style.display='none';
      list.forEach(c => {
        let iframe = '';
        const yid = ytId(c.url);
        const slug = twitchClipSlug(c.url);
        if (slug) {
          iframe = `<iframe src="https://clips.twitch.tv/embed?clip=${slug}&parent=riderskill.github.io"
                     allowfullscreen height="360" width="100%" style="border:0;border-radius:12px;background:#000"></iframe>`;
        } else if (yid) {
          iframe = `<iframe src="https://www.youtube.com/embed/${yid}" title="YouTube video"
                     allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                     allowfullscreen height="360" width="100%" style="border:0;border-radius:12px;background:#000"></iframe>`;
        } else if (c.url) {
          iframe = `<a class="btn youtube" href="${c.url}" target="_blank" rel="noopener">Ouvrir le clip</a>`;
        } else {
          iframe = `<div class="muted">Clip sans URL</div>`;
        }
        const card = document.createElement('div');
        card.className = 'clip';
        card.innerHTML = `${iframe}<div class="meta"><strong>${c.title||'Clip'}</strong><br><span class="muted">${c.album||''}</span></div>`;
        grid.appendChild(card);
      });
    }

    render(clips);
    if (sel) sel.addEventListener('change', () => {
      const v = sel.value.trim();
      render(v ? clips.filter(c => (c.album||'') === v) : clips);
    });

  }catch(e){
    const empty = document.getElementById('clipsEmpty');
    if (empty) empty.style.display='block';
  }
}
