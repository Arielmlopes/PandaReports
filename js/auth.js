getElementById('s-toggle-btn').textContent='›';}
}

// MOBILE SIDEBAR
function openMobileSidebar(){
  document.getElementById('sidebar').classList.add('mob-open');
  document.getElementById('mob-overlay').classList.add('visible');
}
function closeMobileSidebar(){
  document.getElementById('sidebar').classList.remove('mob-open');
  document.getElementById('mob-overlay').classList.remove('visible');
}

// ═══════════════════════════════════════════════════
// LOGO
// ═══════════════════════════════════════════════════
function loadSystemLogo(){
  const saved=localStorage.getItem('panda_logo');
  if(saved){systemLogoUrl=saved;updateLogoDisplays();}
}
function updateLogoDisplays(){
  ['sidebar-logo-icon','login-logo-icon'].forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    if(systemLogoUrl)el.innerHTML=`<img src="${systemLogoUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:5px">`;
    else el.innerHTML='🐼';
  });
}

// ═══════════════════════════════════════════════════
// SAVED CREDENTIALS (localStorage)
// ═══════════════════════════════════════════════════
function loadSavedCredentials(){
  const saved=localStorage.getItem('panda_creds');
  if(!saved)return;
  try{
    const{email,password}=JSON.parse(saved);
    document.getElementById('l-email').value=email||'';
    document.getElementById('l-pass').value=password||'';
    // show saved session card
    const card=document.getElementById('saved-session');
    const emailEl=document.getElementById('saved-email');
    emailEl.textContent=email;
    card.style.display='block';
  }catch(e){}
}
function saveCredentials(email,password){
  if(document.getElementById('remember-me').checked){
    localStorage.setItem('panda_creds',JSON.stringify({email,password}));
  }else{
    localStorage.removeItem('panda_creds');
  }
}
async function loginWithSaved(){
  const saved=localStorage.getItem('panda_creds');
  if(!saved)return;
  try{
    const{email,password}=JSON.parse(saved);
    document.getElementById('l-email').value=email;
    document.getElementById('l-pass').value=password;
    await doLogin();
  }catch(e){}
}

// ═══════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════
async function doLogin(){
  const email=document.getElementById('l-email').value.trim();
  const pass=document.getElementById('l-pass').value;
  const err=document.getElementById('login-err'),btn=document.getElementById('login-btn');
  if(!email||!pass){showErr('Preencha e-mail e senha');return}
  btn.innerHTML='<span class="spinner spinner-dark"></span> Entrando…';btn.disabled=true;
  err.style.display='none';
  const{data,error}=await db.auth.signInWithPassword({email,password:pass});
  if(error){showErr('E-mail ou senha incorretos');btn.innerHTML='Entrar na plataforma';btn.disabled=false;return}
  curUser=data.user;
  await resolveUserRole(email);
  saveCredentials(email,pass);
  enterApp();
}
async function resolveUserRole(email){
  const{data}=await db.from('user_roles').select('role').eq('email',email).single();
  curUserRole=data?.role||'member';
  if(curUserRole==='member'){
    document.body.classList.add('member-mode');
  }else{
    document.body.classList.remove('member-mode');
  }
}
function showErr(msg){const e=document.getElementById('login-err');e.textContent=msg;e.style.display='block';}
async function doLogout(){
  await db.auth.signOut();
  curClient=null;curUser=null;CLIENTS=[];MATS_CACHE={};COLLABS=[];
  document.getElementById('scr-login').style.display='flex';
  document.getElementById('sidebar').style.display='none';
  document.getElementById('main').style.display='none';
}
function enterApp(){
  document.getElementById('scr-login').style.display='none';
  document.getElementById('sidebar').style.display='flex';
  document.getElementById('main').style.display='flex';
  loadSystemLogo();initSidebarState();
  if(curUserRole==='member'){
    Promise.all([loadClients(),loadCollabs(),loadBriefings()]).then(()=>{showScreen('kanban');startNotifPolling();});
  }else{
    Promise.all([loadClients(),loadCollabs(),loadBriefings(),loadAllMatsLight(),loadUserRoles()]).then(()=>{restoreRoute();startNotifPolling();});
  }
}
async function loadUserRoles(){
  const{data,error}=await db.from('user_roles').select('*').order('created_at',{ascending:true});
  USER_ROLES=error?[]:(data||[]);
}

// ═══════════════════════════════════════════════════
// ROTEAMENTO (persiste a tela atual no refresh)
// ═══════════════════════════════════════════════════
function setRoute(hash){
  if(location.hash!==hash)history.replaceState(null,'','#'+hash);
}
async function restoreRoute(){
  if(curUserRole==='member'){showScreen('kanban');return;}
  const h=(location.hash||'').replace(/^#/,'');
  const clientMatch=h.match(/^client\/([^/]+)(?:\/(feed|pedidos))?$/);
  if(clientMatch){
    const c=CLIENTS.find(x=>x.id===clientMatch[1]);
    if(c){
      curClient=c;
      await showScreen('client');
      if(clientMatch[2]==='pedidos')switchClientTab('pedidos');
      return;
    }
  }
  if(h==='kanban'){showScreen('kanban');return;}
  if(h==='todo'){showScreen('todo');return;}
  if(h==='settings'){showScreen('settings');return;}
  showScreen('dashboard');
}
window.addEventListener('DOMContentLoaded',async()=>{
  const params=new URLSearchParams(location.search);
  const formClientId=params.get('form');
  if(formClientId){
    await initPublicForm(formClientId);
    return;
  }
  loadSystemLogo();loadSavedCredentials();
  const{data}=await db.auth.getSession();
  if(data.session){curUser=data.session.user;await resolveUserRole(data.session.user.email);enterApp();}
});

// ═══════════════════════════════════════════════════
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
  const name=docume