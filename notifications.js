// ═══ NOTIFICATIONS — Sino, Menções, Viewer de Anexos ═══
// ATTACHMENT VIEWER (igual Trello — abre, navega, salva)
// ═══════════════════════════════════════════════════
function openAttViewer(cardIdOrFiles, startIdx){
  // called with cardId string (from card detail) or files array (from other contexts)
  let files;
  if(typeof cardIdOrFiles==='string'){
    const card=KANBAN_CARDS.find(c=>c.id===cardIdOrFiles);
    files=card?.attachments||[];
  }else if(Array.isArray(cardIdOrFiles)){
    files=cardIdOrFiles;
  }else{
    try{files=JSON.parse(cardIdOrFiles);}catch(e){files=[];}
  }
  if(!files||!files.length)return;
  attViewerFiles=files;
  attViewerIdx=startIdx||0;
  renderAttViewer();
  document.getElementById('att-viewer').classList.add('open');
}
function closeAttViewer(){
  document.getElementById('att-viewer').classList.remove('open');
  const v=document.querySelector('#att-viewer-main video');
  if(v)v.pause();
}
function attNav(dir){
  attViewerIdx=Math.max(0,Math.min(attViewerFiles.length-1,attViewerIdx+dir));
  renderAttViewer();
}
function renderAttViewer(){
  const f=attViewerFiles[attViewerIdx];
  if(!f)return;
  const main=document.getElementById('att-viewer-main');
  const nameEl=document.getElementById('att-viewer-name');
  const dlBtn=document.getElementById('att-viewer-download');
  const ft=f.ft||'file';
  nameEl.textContent=f.name;
  dlBtn.href='#';
  dlBtn.onclick=(e)=>{e.preventDefault();forceDownload(f.url,f.name);};
  dlBtn.download=f.name;
  // show prev/next arrows only if multiple
  document.getElementById('att-prev').style.display=attViewerFiles.length>1&&attViewerIdx>0?'flex':'none';
  document.getElementById('att-next').style.display=attViewerFiles.length>1&&attViewerIdx<attViewerFiles.length-1?'flex':'none';
  // main content by file type
  if(ft==='video'){
    main.innerHTML=`<video src="${f.url}" controls autoplay style="max-width:100%;max-height:calc(100vh - 160px);border-radius:8px;background:#000;outline:none"></video>`;
  }else if(ft==='pdf'){
    main.innerHTML=`<iframe src="${f.url}" style="width:min(860px,90vw);height:calc(100vh - 180px);border:none;border-radius:8px;background:#fff"></iframe>`;
  }else if(ft==='image'){
    main.innerHTML=`<img src="${f.url}" alt="${f.name}" style="max-width:100%;max-height:calc(100vh - 160px);object-fit:contain;border-radius:8px;box-shadow:0 8px 40px rgba(0,0,0,.6)">`;
  }else{
    // Word, PPT, Excel and others — show download card
    const ext=f.name.split('.').pop().toUpperCase();
    const icon=FILE_TYPE_ICONS[ft]||'📎';
    const gviewUrl=`https://docs.google.com/viewer?url=${encodeURIComponent(f.url)}&embedded=true`;
    const isOffice=['word','ppt','excel'].includes(ft);
    main.innerHTML=`<div style="text-align:center;padding:30px 20px">
      <div style="font-size:72px;margin-bottom:16px">${icon}</div>
      <div style="font-size:16px;font-weight:600;color:var(--text);margin-bottom:6px">${f.name}</div>
      <div style="font-size:13px;color:var(--text3);margin-bottom:22px">Arquivo ${ext}</div>
      ${isOffice?`<button class="btn btn-ghost btn-sm" style="margin-bottom:10px;display:block;margin:0 auto 10px" onclick="openGoogleViewer('${gviewUrl}')">👁 Visualizar no Google Docs</button>`:''}
      <button class="btn btn-green btn-sm" style="display:block;margin:0 auto" onclick="forceDownload('${f.url}','${f.name}')">⬇ Baixar arquivo</button>
    </div>`;
  }
  // thumbnail strip
  const strip=document.getElementById('att-viewer-strip');
  strip.style.display=attViewerFiles.length>1?'flex':'none';
  strip.innerHTML=attViewerFiles.map((af,i)=>`
    <div class="att-viewer-thumb ${i===attViewerIdx?'active':''}" onclick="attNavTo(${i})">
      ${af.ft==='image'
        ?`<img src="${af.url}" alt="${af.name}" loading="lazy">`
        :`<div class="att-thumb-vid">${FILE_TYPE_ICONS[af.ft||'file']||'📎'}</div>`}
    </div>`).join('');
  setTimeout(()=>{
    const active=strip.querySelector('.att-viewer-thumb.active');
    if(active)active.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'});
  },50);
}
function openGoogleViewer(url){window.open(url,'_blank');}
function attNavTo(idx){
  attViewerIdx=idx;
  renderAttViewer();
}
async function forceDownload(url,name){
  try{
    const res=await fetch(url);
    const blob=await res.blob();
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=name;
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href);document.body.removeChild(a);},1000);
    showToast('Download iniciado!');
  }catch(e){
    // fallback: open in new tab
    window.open(url,'_blank');
  }
}

// ═══════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════
function openNotifPanel(){
  document.getElementById('notif-panel').classList.add('open');
  document.getElementById('notif-overlay').classList.add('open');
  loadNotifications().then(renderNotifPanel);
}
function closeNotifPanel(){
  document.getElementById('notif-panel').classList.remove('open');
  document.getElementById('notif-overlay').classList.remove('open');
}
async function loadNotifications(){
  if(!curUser?.email)return;
  const{data,error}=await db.from('notifications')
    .select('*').eq('user_email',curUser.email)
    .order('created_at',{ascending:false}).limit(50);
  NOTIFICATIONS=error?[]:(data||[]);
  updateBellBadge();
}
function updateBellBadge(){
  const unread=NOTIFICATIONS.filter(n=>!n.read).length;
  const badge=document.getElementById('bell-badge');
  if(!badge)return;
  if(unread>0){badge.textContent=unread>99?'99+':unread;badge.style.display='flex';}
  else badge.style.display='none';
}
function renderNotifPanel(){
  const body=document.getElementById('notif-body');if(!body)return;
  if(!NOTIFICATIONS.length){
    body.innerHTML='<div class="notif-empty"><div class="ico">🔔</div><p>Nenhuma notificação ainda</p></div>';return;
  }
  const icons={card_moved:'🗂',mention:'@',comment:'💬',finalized:'✅'};
  const classes={card_moved:'move',mention:'mention',comment:'comment',finalized:'finalized'};
  body.innerHTML=NOTIFICATIONS.map(n=>`
    <div class="notif-item ${n.read?'':'unread'}" onclick="clickNotif('${n.id}','${n.card_id||''}')">
      <div class="notif-ico ${classes[n.type]||'comment'}">${icons[n.type]||'🔔'}</div>
      <div class="notif-content">
        <div class="notif-title">${n.title}</div>
        ${n.body?`<div class="notif-body-text">${n.body}</div>`:''}
        <div class="notif-time">${timeAgo(n.created_at)}</div>
      </div>
    </div>`).join('');
}
async function clickNotif(notifId,cardId){
  // mark as read
  const n=NOTIFICATIONS.find(x=>x.id===notifId);
  if(n&&!n.read){n.read=true;await db.from('notifications').update({read:true}).eq('id',notifId);updateBellBadge();}
  renderNotifPanel();
  if(cardId){closeNotifPanel();await showScreen('kanban');openKbCardDetail(cardId);}
}
async function markAllRead(){
  if(!curUser?.email)return;
  NOTIFICATIONS.forEach(n=>n.read=true);
  await db.from('notifications').update({read:true}).eq('user_email',curUser.email);
  updateBellBadge();renderNotifPanel();showToast('Todas marcadas como lidas');
}
async function createNotification(userEmail,type,title,body,cardId){
  if(!userEmail||userEmail===curUser?.email)return; // don't notify yourself
  const{data}=await db.from('notifications').insert({user_email:userEmail,type,title,body,card_id:cardId||null}).select().single();
  return data;
}
function startNotifPolling(){
  if(notifPollingInterval)clearInterval(notifPollingInterval);
  loadNotifications();
  notifPollingInterval=setInterval(()=>{
    loadNotifications().then(()=>{
      const panelOpen=document.getElementById('notif-panel').classList.contains('open');
      if(panelOpen)renderNotifPanel();
    });
  },30000);
}
function timeAgo(dateStr){
  const d=new Date(dateStr),now=new Date(),diff=Math.floor((now-d)/1000);
  if(diff<60)return'agora mesmo';
  if(diff<3600)return`há ${Math.floor(diff/60)}min`;
  if(diff<86400)return`há ${Math.floor(diff/3600)}h`;
  return`há ${Math.floor(diff/86400)} dia${Math.floor(diff/86400)>1?'s':''}`;
}

// ═══════════════════════════════════════════════════
// MENTION SYSTEM (@mentions in comments)
// ═══════════════════════════════════════════════════
function getMentionableUsers(){
  const users=[];
  USER_ROLES.forEach(r=>{const name=r.email.split('@')[0];users.push({name,email:r.email});});
  COLLABS.forEach(c=>{if(!users.find(u=>u.name.toLowerCase()===c.name.toLowerCase()))users.push({name:c.name,email:null});});
  return users;
}
function setupMentionListener(textarea,cardId){
  const dropdown=document.getElementById('mention-dropdown');
  textarea.addEventListener('keyup',e=>{
    const val=textarea.value,pos=textarea.selectionStart;
    const before=val.slice(0,pos);
    const atIdx=before.lastIndexOf('@');
    if(atIdx>=0&&!before.slice(atIdx).includes(' ')){
      mentionActive=true;mentionStart=atIdx;
      mentionQuery=before.slice(atIdx+1).toLowerCase();
      const users=getMentionableUsers().filter(u=>u.name.toLowerCase().includes(mentionQuery));
      if(users.length){
        const rect=textarea.getBoundingClientRect();
        dropdown.style.top=(rect.bottom+window.scrollY+4)+'px';
        dropdown.style.left=rect.left+'px';
        dropdown.innerHTML=users.map((u,i)=>`
          <div class="mention-opt ${i===0?'active':''}" onclick="insertMention('${u.name}','${u.email||''}',${i})">
            <div class="av">${u.name.charAt(0).toUpperCase()}</div>
            <span>${u.name}</span>
          </div>`).join('');
        dropdown.style.display='block';return;
      }
    }
    mentionActive=false;dropdown.style.display='none';
  });
  textarea.addEventListener('keydown',e=>{
    if(!mentionActive)return;
    if(e.key==='Escape'){mentionActive=false;document.getElementById('mention-dropdown').style.display='none';}
  });
  textarea.addEventListener('blur',()=>{setTimeout(()=>{document.getElementById('mention-dropdown').style.display='none';},200);});
}
function insertMention(name,email,idx){
  const textarea=document.getElementById('new-comment-input');if(!textarea)return;
  const val=textarea.value,pos=textarea.selectionStart;
  const before=val.slice(0,mentionStart);
  const after=val.slice(pos);
  textarea.value=before+'@'+name+' '+after;
  textarea.focus();
  mentionActive=false;
  document.getElementById('mention-dropdown').style.display='none';
}
function parseMentions(text){
  const mentions=[];
  const re=/@(\w+)/g;let m;
  while((m=re.exec(text))!==null){
    const name=m[1].toLowerCase();
    const user=getMentionableUsers().find(u=>u.name.toLowerCase()===name);
    if(user&&user.email)mentions.push(user.email);
  }
  return [...new Set(mentions)];
}

// ═══════════════════════════════════════════════════
