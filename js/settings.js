button>
  </div>`;
}
// â”€â”€â”€ USER ROLES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderRolesList(){
  const list=document.getElementById('roles-list');if(!list)return;
  list.innerHTML=USER_ROLES.map(r=>`
    <div class="role-item">
      <span class="ri-email">${r.email}</span>
      <select onchange="updateUserRole('${r.id}',this.value)">
        <option value="admin" ${r.role==='admin'?'selected':''}>Admin</option>
        <option value="member" ${r.role==='member'?'selected':''}>Membro</option>
      </select>
      <button class="ri-del" onclick="removeUserRole('${r.id}')">ðŸ—‘</button>
    </div>`).join('')||'<div style="font-size:12px;color:var(--text3);margin-bottom:8px">Nenhum usuÃ¡rio cadastrado ainda.</div>';
}
async function addUserRole(){
  const email=document.getElementById('role-new-email').value.trim();
  const pass=document.getElementById('role-new-pass')?.value.trim();
  const role=document.getElementById('role-new-role').value;
  if(!email){showToast('Informe o e-mail',true);return;}
  if(!pass||pass.length<6){showToast('Senha deve ter ao menos 6 caracteres',true);return;}
  const btn=document.getElementById('btn-add-user');
  btn.innerHTML='<span class="spinner spinner-dark"></span>';btn.disabled=true;

  // 1. Cria o usuÃ¡rio no Supabase Auth (signUp nÃ£o faz logout se jÃ¡ houver sessÃ£o ativa no Supabase v2)
  const{data:signUpData,error:signUpErr}=await db.auth.signUp({email,password:pass});
  btn.innerHTML='+ Adicionar';btn.disabled=false;

  if(signUpErr&&!signUpErr.message?.includes('already registered')){
    showToast('Erro ao criar usuÃ¡rio: '+signUpErr.message,true);return;
  }

  // 2. Insere/atualiza a role
  const{data,error}=await db.from('user_roles').upsert({email,role},{onConflict:'email'}).select().single();
  if(error){showToast('UsuÃ¡rio criado mas erro ao salvar role',true);return;}

  const idx=USER_ROLES.findIndex(r=>r.email===email);
  if(idx>=0)USER_ROLES[idx]=data;else USER_ROLES.push(data);
  document.getElementById('role-new-email').value='';
  if(document.getElementById('role-new-pass'))document.getElementById('role-new-pass').value='';
  renderRolesList();

  const alreadyExisted=signUpErr?.message?.includes('already registered');
  showToast(alreadyExisted?`Role de "${email}" atualizada para ${role==='admin'?'Admin':'Membro'}!`:`UsuÃ¡rio "${email}" criado como ${role==='admin'?'Admin':'Membro'}!`);
}
async function updateUserRole(id,role){
  const{error}=await db.from('user_roles').update({role}).eq('id',id);
  if(error){showToast('Erro ao atualizar',true);return;}
  const r=USER_ROLES.find(x=>x.id===id);if(r)r.role=role;
  showToast('FunÃ§Ã£o atualizada!');
}
async function removeUserRole(id){
  const r=USER_ROLES.find(x=>x.id===id);
  if(r?.email===curUser?.email){showToast('VocÃª nÃ£o pode remover seu prÃ³prio acesso',true);return;}
  const{error}=await db.from('user_roles').delete().eq('id',id);
  if(error){showToast('Erro ao remover',true);return;}
  USER_ROLES=USER_ROLES.filter(x=>x.id!==id);
  renderRolesList();
  showToast('UsuÃ¡rio removido');
}
function uploadSystemLogo(input){
  const file=input.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{systemLogoUrl=e.target.result;localStorage.setItem('panda_logo',e.target.result);updateLogoDisplays();document.getElementById('content').innerHTML=renderSettings();showToast('Logo atualizada!');};
  reader.readAsDataURL(file);
}
function removeSystemLogo(){systemLogoUrl=null;localStorage.removeItem('panda_logo');updateLogoDisplays();document.getElementById('content').innerHTML=renderSettings();showToast('Logo removida');}
function clearSavedSession(){localStorage.removeItem('panda_creds');document.getElementById('content').innerHTML=renderSettings();showToast('SessÃ£o salva removida');}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// HELPERS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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
const FILE_TYPE_ICONS={video:'ðŸŽ¬',pdf:'ðŸ“„',word:'ðŸ“',ppt:'ðŸ“Š',excel:'ðŸ“Š',image:'ðŸ–¼',file:'ðŸ“Ž'};
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// EVENTS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
document.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&document.getElementById('scr-login').style.display!=='none')doLogin();
  if(e.key==='Escape'){
    ['ov-upload','ov-new-client','ov-edit-client','ov-new-collab','ov-export-choice','confirm-ov','ov-org-logos','ov-ped-detail','ov-new-kbcard','ov-kbcard-detail','ov-user-roles','ov-new-todo'].forEach(closeOv);
    closeCarousel();closeLightbox();closeMobileSidebar();closeAttViewer();
  }
  if
