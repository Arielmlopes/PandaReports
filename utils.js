// ═══ UTILS — Helpers, Toast, Confirm, Eventos Globais ═══
// HELPERS
// ═══════════════════════════════════════════════════
function openOv(id){document.getElementById(id).classList.add('open');}
function closeOv(id){document.getElementById(id).classList.remove('open');}
function autoGrow(el){el.style.height='auto';el.style.height=el.scrollHeight+'px';}
function safeFileName(name){
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-zA-Z0-9._-]/g,'_')
    .replace(/_+/g,'_')
    .replace(/^_|_$/g,'');
}
function getFileType(f){
  if(f.type.startsWith('video'))return'video';
  if(f.type==='application/pdf'||f.name.toLowerCase().endsWith('.pdf'))return'pdf';
  if(f.type.includes('word')||/\.(doc|docx)$/i.test(f.name))return'word';
  if(f.type.includes('presentation')||f.type.includes('powerpoint')||/\.(ppt|pptx)$/i.test(f.name))return'ppt';
  if(f.type.includes('spreadsheet')||f.type.includes('excel')||/\.(xls|xlsx)$/i.test(f.name))return'excel';
  if(f.type.startsWith('image'))return'image';
  return'file';
}
const FILE_TYPE_ICONS={video:'🎬',pdf:'📄',word:'📝',ppt:'📊',excel:'📊',image:'🖼',file:'📎'};
// Auto-grow all auto-grow textareas after modal opens
function applyAutoGrow(){setTimeout(()=>{document.querySelectorAll('textarea[oninput*="autoGrow"]').forEach(el=>autoGrow(el));},80);}
function confirm2(title,msg,onConfirm){
  document.getElementById('confirm-title').textContent=title;
  document.getElementById('confirm-msg').textContent=msg;
  const btn=document.getElementById('confirm-delete-btn');
  btn.onclick=()=>{closeOv('confirm-ov');onConfirm();};
  openOv('confirm-ov');
}
let _tt=null;
function showToast(msg,isErr=false){
  const el=document.getElementById('toast');
  document.getElementById('toast-msg').textContent=msg;
  el.classList.toggle('err',isErr);
  el.querySelector('.toast-dot').style.background=isErr?'#ef4444':'#6BAF45';
  el.classList.add('show');clearTimeout(_tt);
  _tt=setTimeout(()=>el.classList.remove('show'),3500);
}

// ═══════════════════════════════════════════════════
// EVENTS
// ═══════════════════════════════════════════════════
document.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&document.getElementById('scr-login').style.display!=='none')doLogin();
  if(e.key==='Escape'){
    ['ov-upload','ov-new-client','ov-edit-client','ov-new-collab','ov-export-choice','confirm-ov','ov-org-logos','ov-ped-detail','ov-new-kbcard','ov-kbcard-detail','ov-user-roles','ov-new-todo'].forEach(closeOv);
    closeCarousel();closeLightbox();closeMobileSidebar();closeAttViewer();
  }
  if(document.getElementById('car-ov').classList.contains('open')){if(e.key==='ArrowLeft')carNav(-1);if(e.key==='ArrowRight')carNav(1);}
  if(document.getElementById('att-viewer').classList.contains('open')){if(e.key==='ArrowLeft')attNav(-1);if(e.key==='ArrowRight')attNav(1);}
});
['ov-upload','ov-new-client','ov-edit-client','ov-new-collab','ov-export-choice','confirm-ov','ov-org-logos','ov-ped-detail','ov-new-kbcard','ov-kbcard-detail','ov-user-roles','ov-new-todo'].forEach(id=>{
  document.getElementById(id).addEventListener('click',e=>{if(e.target===document.getElementById(id))closeOv(id);});
});
document.getElementById('car-ov').addEventListener('click',e=>{if(e.target===document.getElementById('car-ov'))closeCarousel();});
document.getElementById('att-viewer').addEventListener('click',e=>{if(e.target===document.getElementById('att-viewer'))closeAttViewer();});
document.getElementById('lb-ov').addEventListener('click',e=>{if(e.target===document.getElementById('lb-ov'))closeLightbox();});
