// ═══ CLIENTS — Clientes, Colaboradores, Materiais, Upload, Sidebar ═══
// CLIENTS
// ═══════════════════════════════════════════════════
async function loadClients(){
  const{data,error}=await db.from('clients').select('*').order('created_at',{ascending:true});
  if(error){showToast('Erro ao carregar clientes',true);return}
  CLIENTS=data||[];renderSidebar();
}
async function submitNewClient(){
  const name=document.getElementById('nc-name').value.trim();
  if(!name){showToast('Informe o nome',true);return}
  const btn=document.getElementById('btn-create-client');
  btn.innerHTML='<span class="spinner spinner-dark"></span>';btn.disabled=true;
  let logoUrl=null;
  const logoData=document.getElementById('nc-logo-data').value;
  if(logoData){
    const blob=dataURLtoBlob(logoData);
    const path=`logos/client_${Date.now()}.jpg`;
    const{error:upErr}=await db.storage.from(BUCKET).upload(path,blob,{upsert:true,contentType:'image/jpeg'});
    if(!upErr){const{data:ud}=db.storage.from(BUCKET).getPublicUrl(path);logoUrl=ud.publicUrl;}
  }
  const{data,error}=await db.from('clients').insert({
    name,color:ncColor,seg:document.getElementById('nc-seg').value.trim(),
    resp:document.getElementById('nc-resp').value.trim(),logo_url:logoUrl
  }).select().single();
  btn.innerHTML='Criar cliente';btn.disabled=false;
  if(error){showToast('Erro ao criar cliente',true);return}
  CLIENTS.push(data);closeOv('ov-new-client');renderSidebar();showToast(`Cliente "${name}" criado!`);
}
async function submitEditClient(){
  const name=document.getElementById('ec-name').value.trim();
  if(!name){showToast('Informe o nome',true);return}
  const btn=document.getElementById('btn-save-client');
  btn.innerHTML='<span class="spinner spinner-dark"></span>';btn.disabled=true;
  let logoUrl=curClient.logo_url||null;
  const logoData=document.getElementById('ec-logo-data').value;
  if(logoData){
    const blob=dataURLtoBlob(logoData);
    const path=`logos/client_${curClient.id}.jpg`;
    const{error:upErr}=await db.storage.from(BUCKET).upload(path,blob,{upsert:true,contentType:'image/jpeg'});
    if(!upErr){const{data:ud}=db.storage.from(BUCKET).getPublicUrl(path);logoUrl=ud.publicUrl;}
  }
  const{data,error}=await db.from('clients').update({
    name,color:ecColor,seg:document.getElementById('ec-seg').value.trim(),
    resp:document.getElementById('ec-resp').value.trim(),logo_url:logoUrl
  }).eq('id',curClient.id).select().single();
  btn.innerHTML='Salvar';btn.disabled=false;
  if(error){showToast('Erro ao salvar',true);return}
  const idx=CLIENTS.findIndex(c=>c.id===curClient.id);
  CLIENTS[idx]=data;curClient=data;
  closeOv('ov-edit-client');renderSidebar();
  document.getElementById('tb-title').textContent=curClient.name;
  showToast('Cliente atualizado!');
  if(document.getElementById('feed'))renderFeed();
}
async function deleteClient(){
  confirm2('Excluir cliente?',`"${curClient.name}" e todos os materiais serão removidos permanentemente.`,async()=>{
    const{error}=await db.from('clients').delete().eq('id',curClient.id);
    if(error){showToast('Erro ao excluir',true);return}
    CLIENTS=CLIENTS.filter(c=>c.id!==curClient.id);
    delete MATS_CACHE[curClient.id];
    curClient=null;closeOv('ov-edit-client');renderSidebar();
    showScreen('dashboard');showToast('Cliente excluído');
  });
}

// ═══════════════════════════════════════════════════
// COLLABS
// ═══════════════════════════════════════════════════
async function loadCollabs(){
  const{data,error}=await db.from('collaborators').select('*').order('name',{ascending:true});
  if(error){COLLABS=[];renderCollabList();return}
  COLLABS=data||[];renderCollabList();
}
function renderCollabList(){
  const el=document.getElementById('collab-list');if(!el)return;
  el.innerHTML=COLLABS.map(c=>`
    <div class="collab-item">
      <div class="collab-avatar">${c.name.charAt(0).toUpperCase()}</div>
      <span class="collab-name" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px">${c.name}</span>
      <button class="collab-del" onclick="deleteCollab('${c.id}','${c.name.replace(/'/g,"\\'")}')" title="Excluir colaborador">🗑</button>
    </div>`).join('')||'<div style="padding:8px 14px;font-size:12px;color:var(--text3)">Nenhum colaborador</div>';
}
function openNewCollabModal(){
  document.getElementById('collab-name').value='';
  document.getElementById('collab-role').value='';
  openOv('ov-new-collab');
  setTimeout(()=>document.getElementById('collab-name').focus(),200);
}
async function submitNewCollab(){
  const name=document.getElementById('collab-name').value.trim();
  if(!name){showToast('Informe o nome',true);return}
  const btn=document.getElementById('btn-create-collab');
  btn.innerHTML='<span class="spinner"></span>';btn.disabled=true;
  const{data,error}=await db.from('collaborators').insert({
    name,role:document.getElementById('collab-role').value.trim()
  }).select().single();
  btn.innerHTML='Adicionar';btn.disabled=false;
  if(error){
    const local={id:'local_'+Date.now(),name,role:document.getElementById('collab-role').value.trim()};
    COLLABS.push(local);closeOv('ov-new-collab');renderCollabList();showToast(`"${name}" adicionado!`);return;
  }
  COLLABS.push(data);closeOv('ov-new-collab');renderCollabList();showToast(`"${name}" adicionado!`);
}
function deleteCollab(id,name){
  confirm2('Excluir colaborador?',`"${name}" será removido. Materiais vinculados não serão afetados.`,async()=>{
    const{error}=await db.from('collaborators').delete().eq('id',id);
    if(error){showToast('Erro ao excluir',true);return}
    COLLABS=COLLABS.filter(c=>c.id!==id);renderCollabList();showToast('Colaborador excluído');
  });
}

// ═══════════════════════════════════════════════════
// MATERIALS
// ═══════════════════════════════════════════════════
async function loadMaterials(clientId){
  const{data,error}=await db.from('materials').select('*, files(*)').eq('client_id',clientId).order('date',{ascending:false});
  if(error){showToast('Erro ao carregar materiais',true);return[]}
  MATS_CACHE[clientId]=data||[];return MATS_CACHE[clientId];
}
function deleteMaterial(matId){
  confirm2('Excluir material?','Esta ação não pode ser desfeita. O material e seus arquivos serão removidos.',async()=>{
    const{error}=await db.from('materials').delete().eq('id',matId);
    if(error){showToast('Erro ao excluir',true);return}
    if(curClient)MATS_CACHE[curClient.id]=(MATS_CACHE[curClient.id]||[]).filter(m=>m.id!==matId);
    ALL_MATS_LIGHT=ALL_MATS_LIGHT.filter(m=>m.id!==matId);
    renderFeed();renderSidebar();showToast('Material excluído');
  });
}

// ═══════════════════════════════════════════════════
// UPLOAD
// ═══════════════════════════════════════════════════
async function submitUpload(){
  if(!curClient)return;
  const btn=document.getElementById('btn-save-upload');
  const prog=document.getElementById('upload-progress'),bar=document.getElementById('upload-progress-bar');
  btn.innerHTML='<span class="spinner spinner-dark"></span> Salvando…';btn.disabled=true;
  prog.style.display='block';bar.style.width='5%';
  try{
    const desc=document.getElementById('up-desc').value.trim();
    const collabId=document.getElementById('up-collab').value||null;
    const today=new Date().toISOString().split('T')[0];
    const{data:mat,error:matErr}=await db.from('materials').insert({
      client_id:curClient.id,type:selType,date:today,
      description:desc||DEF[selType],collaborator_id:collabId
    }).select().single();
    if(matErr)throw matErr;
    bar.style.width='20%';
    const fileRows=[];
    for(let i=0;i<upFiles.length;i++){
      const f=upFiles[i];
      const path=`${curClient.id}/${mat.id}/${Date.now()}_${safeFileName(f.name)}`;
      const{error:upErr}=await db.storage.from(BUCKET).upload(path,f.file,{upsert:true});
      if(upErr)throw upErr;
      const{data:ud}=db.storage.from(BUCKET).getPublicUrl(path);
      fileRows.push({material_id:mat.id,name:f.name,url:ud.publicUrl,file_type:f.ft});
      bar.style.width=`${20+Math.round(((i+1)/upFiles.length)*70)}%`;
    }
    if(fileRows.length>0){const{error:fErr}=await db.from('files').insert(fileRows);if(fErr)throw fErr;}
    bar.style.width='100%';
    mat.files=fileRows;
    mat.collaborator=COLLABS.find(c=>c.id===collabId)||null;
    if(!MATS_CACHE[curClient.id])MATS_CACHE[curClient.id]=[];
    MATS_CACHE[curClient.id].unshift(mat);
    ALL_MATS_LIGHT.push({id:mat.id,client_id:curClient.id,type:selType});
    renderSidebar();
    setTimeout(()=>{prog.style.display='none';bar.style.width='0';closeOv('ov-upload');showScreen('client');showToast(`${TYPES.find(t=>t.id===selType)?.label} adicionado!`);},400);
  }catch(e){console.error(e);showToast('Erro: '+(e.message||e),true);prog.style.display='none';bar.style.width='0';}
  finally{btn.innerHTML='Salvar material';btn.disabled=false;}
}

// ═══════════════════════════════════════════════════
// SIDEBAR RENDER
// ═══════════════════════════════════════════════════
function matCount(cid){return ALL_MATS_LIGHT.filter(m=>m.client_id===cid).length;}
async function loadAllMatsLight(){
  const{data,error}=await db.from('materials').select('id,client_id,type');
  ALL_MATS_LIGHT=error?[]:(data||[]);
}
function syncClientMatCount(cid){
  // após carregar materiais completos de um cliente, sincroniza a contagem leve com a real
  const real=(MATS_CACHE[cid]||[]).map(m=>({id:m.id,client_id:cid,type:m.type}));
  ALL_MATS_LIGHT=ALL_MATS_LIGHT.filter(m=>m.client_id!==cid).concat(real);
}
function renderSidebar(filter=''){
  const list=document.getElementById('c-list');
  const fl=CLIENTS.filter(c=>c.name.toLowerCase().includes(filter.toLowerCase()));
  list.innerHTML=fl.map(c=>`
    <div class="c-item ${curClient&&curClient.id===c.id?'active':''}" onclick="selectClient('${c.id}');closeMobileSidebar()">
      <span class="c-dot" style="background:${c.color}"></span>
      <span class="c-name">${c.name}</span>
      <span class="c-badge">${matCount(c.id)}</span>
    </div>`).join('')||'<div style="padding:9px 13px;font-size:12px;color:var(--text3)">Nenhum cliente</div>';
}
function filterClients(v){renderSidebar(v)}
async function selectClient(id){
  curClient=CLIENTS.find(c=>c.id===id);
  activeP='week';activeT='all';renderSidebar();showScreen('client');
}

// CLIENT MODALS
function openNewClientModal(){
  ncColor=PALETTE[0];
  ['nc-name','nc-seg','nc-resp'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('nc-logo-data').value='';
  document.getElementById('nc-logo-box').innerHTML='<div style="font-size:26px;margin-bottom:5px">🏢</div><div style="font-size:11px;color:var(--text3)">Clique para enviar logo</div>';
  buildColorGrid('nc-colors',ncColor,true);
  openOv('ov-new-client');setTimeout(()=>document.getElementById('nc-name').focus(),200);
}
function buildColorGrid(elId,selected,isNew){
  document.getElementById(elId).innerHTML=PALETTE.map(c=>`
    <div class="color-dot ${c===selected?'sel':''}" style="background:${c}"
         onclick="${isNew?'ncPickColor':'ecPickColor'}('${c}','${elId}')"></div>`).join('');
}
function ncPickColor(c,elId){ncColor=c;buildColorGrid(elId,c,true)}
function ecPickColor(c,elId){ecColor=c;buildColorGrid(elId,c,false)}
function openEditClient(){
  if(!curClient)return;
  ecColor=curClient.color;
  document.getElementById('ec-name').value=curClient.name;
  document.getElementById('ec-seg').value=curClient.seg||'';
  document.getElementById('ec-resp').value=curClient.resp||'';
  document.getElementById('ec-logo-data').value='';
  const box=document.getElementById('ec-logo-box');
  if(curClient.logo_url)box.innerHTML=`<img src="${curClient.logo_url}" class="logo-preview"><div style="font-size:11px;color:var(--text3)">Clique para alterar</div>`;
  else box.innerHTML='<div style="font-size:26px;margin-bottom:5px">🏢</div><div style="font-size:11px;color:var(--text3)">Clique para enviar logo</div>';
  buildColorGrid('ec-colors',ecColor,false);openOv('ov-edit-client');
}
function previewClientLogo(input,boxId,dataId){
  const file=input.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    document.getElementById(dataId).value=e.target.result;
    document.getElementById(boxId).innerHTML=`<img src="${e.target.result}" class="logo-preview"><div style="font-size:11px;color:var(--text3)">Clique para alterar</div>`;
  };reader.readAsDataURL(file);
}

// ═══════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════
async function showScreen(name){
  const ct=document.getElementById('content');
  const tt=document.getElementById('tb-title'),tp=document.getElementById('tb-period');
  const bE=document.getElementById('btn-export'),bEd=document.getElementById('btn-edit'),bU=document.getElementById('btn-upload');
  bE.style.display=bEd.style.display=bU.style.display='none';
  document.getElementById('nav-kanban-btn')?.classList.toggle('active',name==='kanban');
  document.getElementById('nav-todo-btn')?.classList.toggle('active',name==='todo');
  if(name==='dashboard'){
    setRoute('dashboard');
    tt.textContent='Dashboard';tp.textContent='Visão geral';ct.innerHTML=renderDashboard();
  }else if(name==='kanban'){
    setRoute('kanban');
    curClient=null;renderSidebar();
    tt.textContent='Fluxo';tp.textContent='Quadro de demandas da agência';
    ct.innerHTML='<div class="page-loading"><div class="spinner"></div> Carregando quadro…</div>';
    await loadKanbanColumns();await loadKanbanCards();
    ct.innerHTML=renderKanbanScreen();
    setupKanbanDnD();
  }else if(name==='todo'){
    setRoute('todo');
    curClient=null;renderSidebar();
    tt.textContent='To-Do Semanal';tp.textContent='Planejamento da semana';
    ct.innerHTML='<div class="page-loading"><div class="spinner"></div> Carregando…</div>';
    await loadTodoItems();
    ct.innerHTML=renderTodoScreen();
    startTodoColorRefresh();
  }else if(name==='client'&&curClient){
    setRoute(`client/${curClient.id}/feed`);
    tt.textContent=curClient.name;tp.textContent='Carregando…';
    bE.style.display=bEd.style.display=bU.style.display='inline-flex';
    ct.innerHTML='<div class="page-loading"><div class="spinner"></div> Carregando…</div>';
    clientTab='feed';
    await Promise.all([loadMaterials(curClient.id),loadBriefings()]);
    syncClientMatCount(curClient.id);
    tp.textContent='Período atual';switchClientTab('feed');
  }else if(name==='export'&&curClient){
    tt.textContent='Exportar';tp.textContent=curClient.name;
    openOv('ov-export-choice');
  }else if(name==='settings'){
    setRoute('settings');
    tt.textContent='Configurações';tp.textContent='Conta & preferências';ct.innerHTML=renderSettings();
  }
}

// ═══════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════
function renderDashboard(){
  const total=ALL_MATS_LIGHT.length;
  return`<div class="dash-h"><h2>Bem-vindo à Panda Reports 🐼</h2><p>Organize e apresente suas entregas com elegância.</p></div>
    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:22px">
      <div class="kpi-card"><div class="kpi-lbl">Clientes</div><div class="kpi-val g">${CLIENTS.length}</div></div>
      <div class="kpi-card"><div class="kpi-lbl">Entregas totais</div><div class="kpi-val">${total}</div></div>
      <div class="kpi-card"><div class="kpi-lbl">Colaboradores</div><div class="kpi-val g">${COLLABS.length}</div></div>
      <div class="kpi-card"><div class="kpi-lbl">Usuário</div><div class="kpi-val g" style="font-size:12px;letter-spacing:0">${curUser?.email?.split('@')[0]||'—'}</div></div>
    </div>
    <div class="s-sec-label" style="padding:0 0 10px">Clientes</div>
    <div class="cl-grid">
      ${CLIENTS.length===0
        ?'<div class="empty"><div class="ico">🏢</div><h3>Nenhum cliente ainda</h3><p>Clique em "Novo Cliente" para começar</p></div>'
        :CLIENTS.map(c=>{
          const ms=ALL_MATS_LIGHT.filter(m=>m.client_id===c.id);
          const cnt={};TYPES.forEach(t=>{cnt[t.id]=0});ms.forEach(m=>{if(cnt[m.type]!==undefined)cnt[m.type]++;});
          const top=Object.entries(cnt).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,3);
          return`<div class="cl-card" onclick="selectClient('${c.id}')">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
              ${c.logo_url?`<img src="${c.logo_url}" style="width:20px;height:20px;border-radius:5px;object-fit:cover;flex-shrink:0">`:`<span style="width:7px;height:7px;border-radius:50%;background:${c.color};flex-shrink:0"></span>`}
              <h3>${c.name}</h3>
            </div>
            <div class="meta">${ms.length} materiais${c.seg?' · '+c.seg:''}</div>
            <div class="stats">
              ${top.map(([type,count])=>`<div class="stat"><strong style="color:${c.color}">${count}</strong><span>${TYPES.find(t=>t.id===type)?.label||type}</span></div>`).join('')}
              ${top.length===0?'<span style="font-size:12px;color:var(--text3)">Sem materiais ainda</span>':''}
            </div>
          </div>`;}).join('')}
    </div>`;
}

// ═══════════════════════════════════════════════════
// CLIENT SCREEN
// ═══════════════════════════════════════════════════
function getMats(){let ms=MATS_CACHE[curClient.id]||[];if(activeT!=='all')ms=ms.filter(m=>m.type===activeT);return ms;}
function getKPIs(){
  const ms=MATS_CACHE[curClient.id]||[];const c={};TYPES.forEach(t=>{c[t.id]=0});ms.forEach(m=>{if(c[m.type]!==undefined)c[m.type]++;});
  return{total:ms.length,...c};
}
function fmtDate(d){const dt=new Date(d+'T12:00:00');return`${DAYS[dt.getDay()]}, ${dt.getDate()} de ${MONTHS[dt.getMonth()]}`;}
function fmtDateS(d){const dt=new Date(d+'T12:00:00');return`${dt.getDate()} ${MS[dt.getMonth()]} ${dt.getFullYear()}`;}
function groupByDay(ms){
  const g={};
  ms.forEach(m=>{
    const dt=new Date(m.date+'T12:00:00');
    const k=`${DAYS[dt.getDay()]}, ${dt.getDate()} ${MS[dt.getMonth()]}`;
    if(!g[k])g[k]=[];g[k].push(m);
  });return g;
}
function renderClient(){
  const k=getKPIs();
  const logo=curClient.logo_url?`<img src="${curClient.logo_url}" style="width:100%;height:100%;object-fit:cover">`:`<span style="font-size:20px">${curClient.name.charAt(0)}</span>`;
  const clientPedidos=BRIEFINGS.filter(b=>b.client_id===curClient.id);
  const pendingCount=clientPedidos.filter(b=>b.status==='Recebido - Aguardando producao').length;
  return`
    <div class="client-header">
      <div class="client-logo">${logo}</div>
      <div class="client-header-info" style="flex:1">
        <h2>${curClient.name}</h2>
        <p>${curClient.seg||''}${curClient.seg&&curClient.resp?' · ':''}${curClient.resp||''}</p>
      </div>
      <button class="btn btn-indigo btn-sm" onclick="openOrgLogosModal()">🔗 Link de pedido</button>
    </div>
    <div class="f-bar" style="margin-bottom:18px">
      <button class="f-chip ${clientTab==='feed'?'active':''}" onclick="switchClientTab('feed')">🗂 Materiais</button>
      <button class="f-chip ${clientTab==='pedidos'?'active':''}" onclick="switchClientTab('pedidos')">📋 Pedidos${pendingCount>0?` <span style="background:rgba(234,179,8,.25);color:#eab308;padding:1px 6px;border-radius:100px;font-size:10px;margin-left:3px">${pendingCount}</span>`:''}</button>
    </div>
    <div id="client-tab-body"></div>`;
}
function switchClientTab(tab){
  clientTab=tab;
  if(curClient)setRoute(`client/${curClient.id}/${tab}`);
  const c=document.getElementById('content');
  c.innerHTML=renderClient();
  if(tab==='feed'){
    document.getElementById('btn-export').style.display='inline-flex';
    document.getElementById('btn-upload').style.display='inline-flex';
    document.getElementById('client-tab-body').innerHTML=`
      <div class="kpi-grid">
        <div class="kpi-card"><div class="kpi-lbl">Total</div><div class="kpi-val g">${getKPIs().total}</div><div class="kpi-sub">materiais</div></div>
        <div class="kpi-card"><div class="kpi-lbl">Posts</div><div class="kpi-val">${getKPIs().post}</div></div>
        <div class="kpi-card"><div class="kpi-lbl">Carrosséis</div><div class="kpi-val">${getKPIs().carousel}</div></div>
        <div class="kpi-card"><div class="kpi-lbl">Vídeos & Reels</div><div class="kpi-val">${getKPIs().video+getKPIs().reels}</div></div>
        <div class="kpi-card"><div class="kpi-lbl">Stories</div><div class="kpi-val">${getKPIs().story}</div></div>
      </div>
      <div class="f-bar" id="f-bar">
        <span class="f-lbl">Período:</span>
        <button class="f-chip ${activeP==='week'?'active':''}" data-p="week">Esta semana</button>
        <button class="f-chip ${activeP==='lastweek'?'active':''}" data-p="lastweek">Sem. passada</button>
        <button class="f-chip ${activeP==='month'?'active':''}" data-p="month">Este mês</button>
        <div class="f-div"></div>
        <span class="f-lbl">Tipo:</span>
        <button class="f-chip ${activeT==='all'?'active':''}" data-t="all">Todos</button>
        ${TYPES.map(t=>`<button class="f-chip ${activeT===t.id?'active':''}" data-t="${t.id}">${t.emoji} ${t.label}</button>`).join('')}
      </div>
      <div id="feed"></div>`;
    setupFilters();
  }else{
    document.getElementById('btn-export').style.display='none';
    document.getElementById('btn-upload').style.display='none';
    document.getElementById('client-tab-body').innerHTML=renderClientPedidos();
  }
}
function renderClientPedidos(){
  const list=BRIEFINGS.filter(b=>b.client_id===curClient.id);
  if(list.length===0)return'<div class="empty"><div class="ico">📭</div><h3>Nenhum pedido recebido</h3><p>Compartilhe o link de pedido deste cliente para receber solicitações</p></div>';
  return list.map(b=>renderPedCard(b)).join('');
}
function renderFeed(){
  const ms=getMats(),g=groupByDay(ms),feed=document.getElementById('feed');
  if(!feed)return;
  if(!Object.keys(g).length){feed.innerHTML='<div class="empty"><div class="ico">📭</div><h3>Nenhum material</h3><p>Adicione materiais com o botão acima</p></div>';return;}
  feed.innerHTML=Object.entries(g).map(([day,items])=>`
    <div class="feed-sec">
      <div class="feed-day">${day}<span class="feed-day-ct">${items.length} ${items.length===1?'item':'itens'}</span></div>
      <div class="feed-grid">${items.map(m=>renderCard(m)).join('')}</div>
    </div>`).join('');
}
function renderCard(m){
  const t=TYPES.find(t=>t.id===m.type);
  const isCar=m.type==='carousel';
  const files=m.files||[];const first=files[0];
  let thumb='';
  if(first?.url){
    if(first.file_type==='video')thumb=`<video src="${first.url}" muted preload="metadata" style="width:100%;height:100%;object-fit:cover"></video>`;
    else thumb=`<img src="${first.url}" alt="" loading="lazy">`;
  }else thumb=`<span class="placeholder">${t?.emoji||'📄'}</span>`;
  const fn=isCar?`openCarousel('${m.id}')`:`openLightbox('${m.id}')`;
  const collabName=COLLABS.find(c=>c.id===m.collaborator_id)?.name||'';
  return`
    <div class="mat-card">
      <div class="mat-thumb" onclick="${fn}">
        ${thumb}
        <span class="mat-badge ${t?.bc||''}">${t?.label||m.type}</span>
        ${isCar?`<div class="slide-ct">▪ ${files.length} slides</div>`:''}
        <button class="mat-delete" onclick="event.stopPropagation();deleteMaterial('${m.id}')" title="Excluir">🗑</button>
      </div>
      <div class="mat-info">
        <div class="mat-date">${fmtDate(m.date)}</div>
        <div class="mat-desc">${m.description||'Sem descrição'}</div>
        ${collabName?`<div class="mat-collab">👤 ${collabName}</div>`:''}
      </div>
    </div>`;
}
function setupFilters(){
  setTimeout(()=>{
    renderFeed();
    document.querySelectorAll('[data-p]').forEach(b=>b.addEventListener('click',function(){
      document.querySelectorAll('[data-p]').forEach(x=>x.classList.remove('active'));
      this.classList.add('active');activeP=this.dataset.p;renderFeed();
    }));
    document.querySelectorAll('[data-t]').forEach(b=>b.addEventListener('click',function(){
      document.querySelectorAll('[data-t]').forEach(x=>x.classList.remove('active'));
      this.classList.add('active');activeT=this.dataset.t;renderFeed();
    }));
  },80);
}

// ═══════════════════════════════════════════════════
// UPLOAD UI
// ═══════════════════════════════════════════════════
function openUploadModal(){
  selType='post';upFiles=[];
  document.getElementById('up-desc').value='';
  document.getElementById('dz-files').innerHTML='';
  document.getElementById('preview-strip').innerHTML='';
  document.getElementById('dz-hint').textContent='PNG, JPG, MP4 · múltiplos arquivos';
  const sel=document.getElementById('up-collab');
  sel.innerHTML='<option value="">— Selecionar —</option>'+COLLABS.map(c=>`<option value="${c.id}">${c.name}${c.role?' ('+c.role+')':''}</option>`).join('');
  document.getElementById('type-grid').innerHTML=TYPES.map(t=>`
    <div class="type-btn ${t.id==='post'?'sel':''}" onclick="pickType('${t.id}',this)">
      <span class="te">${t.emoji}</span><span class="tl">${t.label}</span>
    </div>`).join('');
  openOv('ov-upload');
}
function pickType(id,el){
  selType=id;document.querySelectorAll('.type-btn').forEach(b=>b.classList.remove('sel'));el.classList.add('sel');
  const hint=document.getElementById('dz-hint');
  if(id==='carousel')hint.textContent='Múltiplas imagens = 1 carrossel agrupado';
  else if(id==='video'||id==='reels')hint.textContent='MP4, MOV, AVI';
  else hint.textContent='PNG, JPG, GIF, WEBP';
}
function onDragOver(e){e.preventDefault();document.getElementById('dropzone').classList.add('drag')}
function onDragLeave(){document.getElementById('dropzone').classList.remove('drag')}
function onDrop(e){e.preventDefault();document.getElementById('dropzone').classList.remove('drag');handleFiles(e.dataTransfer.files)}
function onFileSelect(inp){handleFiles(inp.files);inp.value='';}
function handleFiles(files){
  Array.from(files).slice(0,30).forEach(f=>{upFiles.push({file:f,url:URL.createObjectURL(f),name:f.name,ft:getFileType(f)});});
  renderUpFiles();
}
function removeFile(i){URL.revokeObjectURL(upFiles[i].url);upFiles.splice(i,1);renderUpFiles();}
function renderUpFiles(){
  document.getElementById('dz-files').innerHTML=upFiles.map((f,i)=>`
    <div class="dz-file">
      <span>${f.ft==='video'?'🎬':'🖼'}</span>
      <span class="fn">${f.name}</span>
      <span class="sz">${(f.file.size/1024).toFixed(0)} KB</span>
      <span class="rm" onclick="removeFile(${i})">×</span>
    </div>`).join('');
  document.getElementById('preview-strip').innerHTML=upFiles.map(f=>
    f.ft==='image'?`<img class="p-thumb" src="${f.url}" alt="">`:`<div class="p-thumb-v">${FILE_TYPE_ICONS[f.ft]||'📎'}</div>`).join('');
}

// ═══════════════════════════════════════════════════
