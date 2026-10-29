// Dipakai table.html dan design.html (butuh supabase-js + config.js lebih dulu)
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nz = v => v !== null && v !== undefined && v !== '';
const SL = {submitted:'Submitted Polygon', revision:'Revision Polygon', ongoing_design:'Ongoing Design', design_complete:'Design Complete', ongoing_dsi:'Ongoing DSI', dsi_complete:'DSI Complete'};
const SC = {submitted:'#2563eb', revision:'#d97706', ongoing_design:'#0891b2', design_complete:'#7c3aed', ongoing_dsi:'#db2777', dsi_complete:'#15803d'};
const badge = st => `<span class="st" style="background:${SC[st]||'#666'}">${SL[st]||esc(st)}</span>`;
const badges = p => badge(p.status);
const areaColor = p => SC[p.status] || '#0e7c7b';
const locked = p => p.status === 'dsi_complete';                                   // DSI Complete = terkunci
const canUpload = p => p.status !== 'dsi_complete';                                // designer boleh upload / upload ulang
const canStartDesign = p => p.status === 'submitted' || p.status === 'revision';   // tombol "Upload Design"
const canStartDsi = p => p.status === 'design_complete';                           // tombol "Submit DSI"
const canDsi = p => p.status === 'design_complete' || p.status === 'ongoing_dsi';  // form Submit DSI
const fmt = t => t ? new Date(t).toLocaleString('id-ID') : '';
function ago(t){
  if(!t) return '';
  let m = Math.max(0, Math.floor((Date.now() - new Date(t)) / 60000));
  const d = Math.floor(m / 1440); m -= d * 1440;
  const h = Math.floor(m / 60); m -= h * 60;
  return d ? `${d} hari ${h} jam lalu` : h ? `${h} jam ${m} menit lalu` : `${m} menit lalu`;
}
// ---- Notifikasi = modal HTML (pengganti toast, alert, dan confirm) ----
const NMK = {success:['#15803d','✓','Berhasil'], error:['#b91c1c','!','Terjadi kesalahan'], warn:['#d97706','!','Perhatian'], info:['#0e7c7b','i','Informasi'], confirm:['#d97706','?','Konfirmasi']};
let nmQ = [], nmCur = null, nmTimer = null;
function nmKind(m){
  if(/gagal|error|violat|denied|terkunci|ditolak|tidak ditemukan|tidak bisa|salah|failed|not found|permission/i.test(m)) return 'error';
  if(/wajib|harus|Selesaikan|Pilih |Zoom in|belum|tidak valid|invalid|Koordinat/i.test(m)) return 'warn';
  if(/disimpan|ditambahkan|diperbarui|dihapus|terupload|disubmit|Status:|berhasil|dibatalkan/i.test(m)) return 'success';
  return 'info';
}
function nmEl(){
  let el = document.getElementById('nm'); if(el) return el;
  const st = document.createElement('style');
  st.textContent = `#nm{position:fixed;inset:0;background:rgba(15,42,44,.55);display:none;align-items:center;justify-content:center;z-index:20000;padding:16px}
#nm .nb{background:#fff;color:#0f2a2c;border-radius:12px;width:min(380px,100%);padding:20px;box-shadow:0 12px 40px rgba(0,0,0,.4);font-family:'IBM Plex Sans',system-ui,sans-serif;font-size:14px;text-align:center}
#nm .ni{width:44px;height:44px;border-radius:50%;margin:0 auto 10px;display:grid;place-items:center;color:#fff;font-size:22px;font-weight:700}
#nm .nt{font-weight:600;font-size:15px;margin-bottom:4px}
#nm .nx{color:#3d5553;white-space:pre-line;word-break:break-word;margin-bottom:14px}
#nm .na{display:flex;gap:8px;justify-content:center}
#nm .na button{min-width:88px;padding:8px 14px;border-radius:8px;border:1px solid #c5cfcb;background:#fff;color:#0f2a2c;cursor:pointer;font:inherit}
#nm .na button.pri{background:#0f2a2c;color:#fff;border-color:#0f2a2c}
#nm .na button.dng{background:#a02020;color:#fff;border-color:#a02020}
#nm .na button:focus-visible{outline:2px solid #0e7c7b;outline-offset:2px}`;
  document.head.appendChild(st);
  el = document.createElement('div'); el.id = 'nm';
  el.innerHTML = '<div class="nb" role="alertdialog" aria-modal="true" aria-labelledby="nmt" aria-describedby="nmx"><div class="ni" id="nmi"></div><div class="nt" id="nmt"></div><div class="nx" id="nmx"></div><div class="na" id="nma"></div></div>';
  el.addEventListener('click', e => { if(e.target === el) nmClose(false); });
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && nmCur){ e.stopPropagation(); nmClose(false); } }, true);
  document.body.appendChild(el);
  return el;
}
function nmShow(){
  if(nmCur || !nmQ.length) return;
  nmCur = nmQ.shift();
  const el = nmEl(), k = NMK[nmCur.type] || NMK.info, g = id => document.getElementById(id);
  g('nmi').style.background = k[0]; g('nmi').textContent = k[1];
  g('nmt').textContent = k[2]; g('nmx').textContent = nmCur.msg;
  const a = g('nma'); a.innerHTML = '';
  const mk = (txt, cls, val) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = txt; if(cls) b.className = cls; b.onclick = () => nmClose(val); a.appendChild(b); return b; };
  let main;
  if(nmCur.type === 'confirm'){ mk('Batal', '', false); main = mk(nmCur.ok, 'dng', true); }
  else main = mk('OK', 'pri', true);
  el.style.display = 'flex'; main.focus();
  if(nmCur.type === 'success' || nmCur.type === 'info') nmTimer = setTimeout(() => nmClose(true), 2400);
}
function nmClose(v){
  if(!nmCur) return;
  clearTimeout(nmTimer); document.getElementById('nm').style.display = 'none';
  const c = nmCur; nmCur = null; c.res(v); nmShow();
}
function notify(msg, type){
  const m = String(msg);
  if((nmCur && nmCur.msg === m) || (nmQ.length && nmQ[nmQ.length-1].msg === m)) return Promise.resolve(true);   // jangan menumpuk pesan sama
  return new Promise(res => { nmQ.push({msg:m, type:type || nmKind(m), res}); nmShow(); });
}
function ask(msg, okLabel){ return new Promise(res => { nmQ.push({msg:String(msg), type:'confirm', ok:okLabel || 'Ya', res}); nmShow(); }); }
function toast(msg, type){ notify(msg, type); }   // nama lama tetap dipakai di seluruh kode
// Header + cek login. Mengembalikan peran user, atau null (sudah dialihkan / tanpa peran).
async function initPage(active){
  $('hdr').innerHTML = `<header class="top"><b>DIGIMON GIS</b>
    <nav><a href="index.html" class="${active==='map'?'on':''}">Peta Polygon</a><a href="table.html" class="${active==='table'?'on':''}">List Polygon</a></nav>
    <span class="sp"></span><span class="sub" id="who"></span>
    <button id="out" type="button">Keluar</button></header>`;
  $('out').onclick = async () => { await sb.auth.signOut(); location.href = 'index.html'; };
  const {data:{session}} = await sb.auth.getSession();
  if(!session){ location.href = 'index.html'; return null; }
  const {data:role} = await sb.rpc('my_role');
  $('who').textContent = role || 'tanpa peran';
  if(!role){ toast('Akun belum punya peran. Hubungi admin.'); return null; }
  return role;
}
async function dlFile(path){
  const {data, error} = await sb.storage.from('designs').createSignedUrl(path, 60);
  error ? toast(error.message) : window.open(data.signedUrl, '_blank');
}
// KML -> GeoJSON (Point, LineString, Polygon)
function parseKml(text){
  const doc = new DOMParser().parseFromString(text, 'text/xml');
  if(doc.getElementsByTagName('parsererror').length) throw new Error('File KML tidak valid');
  const pts = el => { const c = el.getElementsByTagName('coordinates')[0]; if(!c) return [];
    return c.textContent.trim().split(/\s+/).map(t => t.split(',').slice(0,2).map(Number)).filter(a => a.length===2 && isFinite(a[0]) && isFinite(a[1])); };
  const ring = el => { const r = el.getElementsByTagName('LinearRing')[0]; return r ? pts(r) : []; };
  const feats = [];
  for(const pm of doc.getElementsByTagName('Placemark')){
    const props = {name: pm.getElementsByTagName('name')[0]?.textContent || '', desc: pm.getElementsByTagName('description')[0]?.textContent || ''};
    const add = g => feats.push({type:'Feature', properties:props, geometry:g});
    for(const e of pm.getElementsByTagName('Point')){ const c = pts(e)[0]; if(c) add({type:'Point', coordinates:c}); }
    for(const e of pm.getElementsByTagName('LineString')){ const c = pts(e); if(c.length > 1) add({type:'LineString', coordinates:c}); }
    for(const e of pm.getElementsByTagName('Polygon')){
      const o = e.getElementsByTagName('outerBoundaryIs')[0]; if(!o) continue;
      const rings = [ring(o), ...[...e.getElementsByTagName('innerBoundaryIs')].map(ring)].filter(r => r.length > 3);
      if(rings.length) add({type:'Polygon', coordinates:rings});
    }
  }
  if(!feats.length) throw new Error('KML tidak berisi objek (Point/LineString/Polygon)');
  return {type:'FeatureCollection', features:feats};
}
