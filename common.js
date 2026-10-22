// Dipakai table.html dan design.html (butuh supabase-js + config.js lebih dulu)
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nz = v => v !== null && v !== undefined && v !== '';
const PL = {submitted:'Submitted Polygon', revision:'Revision Polygon'};
const DL = {ongoing:'Ongoing Design', complete:'Design Complete'};
const IL = {ongoing:'Ongoing DSI', complete:'DSI Complete'};
const PC = {submitted:'#2563eb', revision:'#d97706'}, DC = {ongoing:'#64748b', complete:'#7c3aed'}, IC = {ongoing:'#64748b', complete:'#15803d'};
const pill = (t, c) => `<span class="st" style="background:${c}">${t}</span>`;
const bPoly = v => pill(PL[v] || esc(v), PC[v] || '#666');
const bDesign = v => pill(DL[v] || esc(v), DC[v] || '#666');
const bDsi = v => pill(IL[v] || esc(v), IC[v] || '#666');
const badges = p => bPoly(p.polygon_status) + ' ' + bDesign(p.design_status) + ' ' + bDsi(p.dsi_status);
const areaColor = p => p.dsi_status === 'complete' ? '#15803d' : p.design_status === 'complete' ? '#7c3aed' : p.polygon_status === 'revision' ? '#d97706' : '#2563eb';
const locked = p => p.dsi_status === 'complete';                          // DSI Complete = terkunci
const canUpload = p => p.dsi_status !== 'complete';                       // designer boleh upload / upload ulang
const canDsi = p => p.design_status === 'complete' && p.dsi_status !== 'complete';
const fmt = t => t ? new Date(t).toLocaleString('id-ID') : '';
function ago(t){
  if(!t) return '';
  let m = Math.max(0, Math.floor((Date.now() - new Date(t)) / 60000));
  const d = Math.floor(m / 1440); m -= d * 1440;
  const h = Math.floor(m / 60); m -= h * 60;
  return d ? `${d} hari ${h} jam lalu` : h ? `${h} jam ${m} menit lalu` : `${m} menit lalu`;
}
function toast(msg){
  let t = $('toast');
  if(!t){ t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.style.display = 'block';
  clearTimeout(t._t); t._t = setTimeout(() => t.style.display = 'none', 3500);
}
// Header + cek login. Mengembalikan peran user, atau null (sudah dialihkan / tanpa peran).
async function initPage(active){
  $('hdr').innerHTML = `<header class="top"><b>DIGIMON GIS</b>
    <nav><a href="index.html" class="${active==='map'?'on':''}">Peta Polygon</a><a href="design.html" class="${active==='design'?'on':''}">View Design</a><a href="table.html" class="${active==='table'?'on':''}">Data Tabel</a></nav>
    <span id="ttl"></span><span class="sub" id="sub"></span><span class="sp"></span><span class="sub" id="who"></span>
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
