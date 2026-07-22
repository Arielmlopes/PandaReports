iv class="ico">✅</div><h3>Nenhuma tarefa concluída esta semana</h3><p>Vá arrasar nas tarefas!</p></div>';
  return`<div class="todo-done-list">
    ${done.map(t=>{
      const client=CLIENTS.find(c=>c.id===t.client_id);
      const late=wasCompletedLate(t);
      const statusTag=t.task_time
        ?(late===true?'<span class="todo-done-late">⚠ Em atraso</span>':'<span class="todo-done-ontime">✓ No prazo</span>')
        :'<span class="todo-done-ontime">✓ Concluído</span>';
      const completedTime=t.completed_at?new Date(t.completed_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
      return`<div class="todo-done-item">
        <span style="font-size:16px">${late===true?'🔴':'✅'}</span>
        <div style="flex:1;min-width:0">
          <div class="ti">${t.title}</div>
          <div style="display:flex;align-items:center;gap:5px;margin-top:3px;flex-wrap:wrap">
            ${client?`<span class="todo-client-dot" style="background:${client.color}"></span><span style="font-size:10px;color:var(--text3)">${client.name}</span>`:''}
            ${t.task_time?`<span style="font-size:10px;color:var(--text3)">Previsto: ${fmtTime(t.task_time)}</span>`:''}
            ${statusTag}
          </div>
        </div>
        <span class="td">${completedTime}</span>
        <button class="btn btn-ghost btn-sm" onclick="toggleTodo('${t.id}')">Desfazer</button>
      </div>`;}).join('')}
  </div>`;
}
function setTodoTab(tab){todoTab=tab;const ct=document.getElementById('content');if(ct)ct.innerHTML=renderTodoScreen();}
async function navTodoWeek(dir){todoWeekDate=addDays(todoWeekDate,dir*7);const ct=document.getElementById('content');if(ct)ct.innerHTML='<div class="page-loading"><div class="spinner"></div> Carregando…</div>';await loadTodoItems();if(ct)ct.innerHTML=renderTodoScreen();}
function navTodoToday(){const today=getMondayOfWeek(new Date());if(weekDateStr(today)===weekDateStr(todoWeekDate))return;todoWeekDate=today;navTodoWeek(0);}
async function toggleTodo(id){
  const t=TODO_ITEMS.find(x=>x.id===id);if(!t)return;
  t.completed=!t.completed;
  t.completed_at=t.completed?new Date().toISOString():null;
  // check if late
  const late=t.completed?wasCompletedLate(t):null;
  t.completed_late=late===true;
  await db.from('todo_items').update({completed:t.completed,completed_at:t.completed_at,completed_late:t.completed_late}).eq('id',id);
  const ct=document.getElementById('content');if(ct)ct.innerHTML=renderTodoScreen();
}
function openNewTodo(dayNum){
  document.getElementById('todo-editing-id').value='';
  document.getElementById('todo-title').value='';
  document.getElementById('todo-time').value='';
  document.getElementById('todo-modal-title').textContent='Nova tarefa';
  document.getElementById('todo-day').value=dayNum||1;
  document.getElementById('btn-delete-todo').style.display='none';
  document.getElementById('todo-client').innerHTML='<option value="">— Nenhum —</option>'+CLIENTS.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  document.getElementById('todo-assigned').innerHTML='<option value="">— Sem atribuição —</option>'+USER_ROLES.map(r=>`<option value="${r.email}">${r.email.split('@')[0]}</option>`).join('');
  document.getElementById('todo-recurring-tog').classList.remove('on');
  openOv('ov-new-todo');
  setTimeout(()=>document.getElementById('todo-title').focus(),200);
}
function openEditTodo(id){
  const t=TODO_ITEMS.find(x=>x.id===id);if(!t)return;
  document.getElementById('todo-editing-id').value=id;
  document.getElementById('todo-title').value=t.title;
  document.getElementById('todo-time').value=t.task_time?t.task_time.slice(0,5):'';
  document.getElementById('todo-modal-title').textContent='Editar tarefa';
  document.getElementById('todo-day').value=t.day_of_week;
  document.getElementById('btn-delete-todo').style.display='inline-flex';
  document.getElementById('todo-client').innerHTML='<option value="">— Nenhum —</option>'+CLIENTS.map(c=>`<option value="${c.id}" ${c.id===t.client_id?'selected':''}>${c.name}</option>`).join('');
  document.getElementById('todo-assigned').innerHTML='<option value="">— Sem atribuição —</option>'+USER_ROLES.map(r=>`<option value="${r.email}" ${r.email===t.assigned_email?'selected':''}>${r.email.split('@')[0]}</option>`).join('');
  if(t.is_recurring)document.getElementById('todo-recurring-tog').classList.add('on');
  else document.getElementById('todo-recurring-tog').classList.remove('on');
  openOv('ov-new-todo');
}
async function deleteTodoItem(){
  const id=document.getElementById('todo-editing-id').value;
  if(!id)return;
  const t=TODO_ITEMS.find(x=>x.id===id);
  if(!t)return;
  const isRecurring=t.is_recurring;
  const confirmMsg=isRecurring
    ?`"${t.title}" é recorrente.\nSera removida desta semana e de todas as semanas futuras.`
    :`"${t.title}" será removida permanentemente.`;
  confirm2('Excluir tarefa?',confirmMsg,async()=>{
    if(isRecurring){
      // Apaga esta semana + todas as semanas futuras com o mesmo título/dia
      const wStr=weekDateStr(todoWeekDate);
      const{error}=await db.from('todo_items').delete()
        .eq('is_recurring',true)
        .eq('title',t.title)
        .eq('day_of_week',t.day_of_week)
        .gte('week_date',wStr);
      if(error){showToast('Erro ao excluir: '+error.message,true);return;}
      // Remove do cache local todas as instâncias futuras
      TODO_ITEMS=TODO_ITEMS.filter(x=>
        !(x.is_recurring&&x.title===t.title&&x.day_of_week===t.day_of_week&&x.week_date>=wStr)
      );
    }else{
      const{error}=await db.from('todo_items').delete().eq('id',id);
      if(error){showToast('Erro ao excluir: '+error.message,true);return;}
      TODO_ITEMS=TODO_ITEMS.filter(x=>x.id!==id);
    }
    closeOv('ov-new-todo');
    const ct=document.getElementById('content');if(ct)ct.innerHTML=renderTodoScreen();
    showToast(isRecurring?'Tarefa recorrente removida desta semana em diante':'Tarefa excluída');
  });
}
async function submitTodo(){
  const title=document.getElementById('todo-title').value.trim();
  if(!title){showToast('Informe o título da tarefa',true);return;}
  const editId=document.getElementById('todo-editing-id').value;
  const recurring=document.getElementById('todo-recurring-tog').classList.contains('on');
  const wStr=weekDateStr(todoWeekDate);
  const timeVal=document.getElementById('todo-time').value||null;
  const payload={
    title,day_of_week:parseInt(document.getElementById('todo-day').value),
    client_id:document.getElementById('todo-client').value||null,
    assigned_email:document.getElementById('todo-assigned').value||null,
    is_recurring:recurring,week_date:wStr,task_time:timeVal,
  };
  const btn=document.getElementById('btn-save-todo');
  btn.innerHTML='<span class="spinner spinner-dark"></span>';btn.disabled=true;
  if(editId){
    const{error}=await db.from('todo_items').update(payload).eq('id',editId);
    const idx=TODO_ITEMS.findIndex(t=>t.id===editId);
    if(!error&&idx>=0)Object.assign(TODO_ITEMS[idx],payload);
  }else{
    const{data,error}=await db.from('todo_items').insert({...payload,completed:false,position:TODO_ITEMS.filter(t=>t.day_of_week===payload.day_of_week&&t.week_date===wStr).length}).select().single();
    if(!error&&data)TODO_ITEMS.push(data);
  }
  btn.innerHTML='Salvar tarefa';btn.disabled=false;
  closeOv('ov-new-todo');
  const ct=document.getElementById('content');if(ct)ct.innerHTML=renderTodoScreen();
  showToast(editId?'Tarefa atualizada!':'Tarefa criada!');
}
// Auto-refresh colors every minute while on todo screen
let todoColorInterval=null;
function startTodoColorRefresh(){
  if(todoColorInterval)clearInterval(todoColorInterval);
  todoColorInterval=setInterval(()=>{
    const ct=document.getElementById('content');
    if(ct&&document.getElementById('nav-todo-btn')?.classList.contains('active'))
      ct.innerHTML=renderTodoScreen();
  },60000);
}

// ═══════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════
function renderSettings(){
  return`<div class="set-wrap">
    <div class="set-sec"><h3>Logo do sistema</h3>
      <p style="font-size:12px;color:var(--text3);margin-bottom:11px">Aparece na sidebar, login e nos PDFs exportados.</p>
      <div class="logo-upload-box" onclick="document.getElementById('sys-logo-input').click()" style="margin-bottom:9px">
        ${systemLogoUrl?`<img src="${systemLogoUrl}" class="logo-preview"><div style="font-size:11px;color:var(--text3)">Clique para alterar</div>`:'<div style="font-size:26px;margin-bottom:5px">🐼</div><div style="font-size:11px;color:var(--text3)">Clique para enviar sua logo</div>'}
      </div>
      <input type="file" id="sys-logo-input" accept="image/*" style="display:none" onchange="uploadSystemLogo(this)">
      ${systemLogoUrl?`<button class="btn btn-red btn-sm" onclick="removeSystemLogo()">Remover logo</button>`:''}
    </div>
    <div class="set-sec"><h3>Conta</h3>
      <div class="set-row"><label>E-mail</label><span style="color:var(--text3);font-size:13px">${curUser?.email||'—'}</span></div>
      <div class="set-row"><label>Função</label><span style="color:${curUserRole==='admin'?'var(--green)':'#818cf8'};font-size:13px;font-weight:600">${curUserRole==='admin'?'Admin':'Membro'}</span></div>
      <div class="set-row"><label>Sessão salva</label>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:12px;color:var(--text3)">${localStorage.getItem('panda_creds')?'✓ Ativa':'Inativa'}</span>
          ${localStorage.getItem('panda_creds')?`<button class="btn btn-ghost btn-sm" onclick="clearSavedSession()">Limpar</button>`:''}
        </div>
      </div>
    </div>
    ${curUserRole==='admin'?`
    <div class="set-sec"><h3>Usuários e permissões</h3>
      <p style="font-size:12px;color:var(--text3);margin-bottom:12px">Admin tem acesso total. Membro acessa apenas o Fluxo.</p>
      <button class="btn btn-indigo btn-sm" style="margin-bottom:12px" onclick="openOv('ov-user-roles');renderRolesList()">Gerenciar usuários</button>
    </div>`:''}
    <div class="set-sec"><h3>Notificações</h3>
      <div class="set-row"><label>Resumo semanal</label><div class="tog on" onclick="this.classList.toggle('on')"></div></div>
      <div class="set-row"><label>Alertas de upload</label><div class="tog on" onclick="this.classList.toggle('on')"></div></div>
      <div class="set-row"><label>Relatórios por e-mail</label><div class="tog" onclick="this.classList.toggle('on')"></div></div>
    </div>
    <button class="btn btn-red" style="width:100%;justify-content:center;margin-top:6px" onclick="doLogout()">Sair da conta</button>
  </div>`;
}
// ─── USER ROLES ─────────────────────────────────────
function renderRolesList(){
  const list=document.getElementById('roles-list');if(!list)return;
  list.innerHTML=USER_ROLES.map(r=>`
    <div class="role-item">
      <span class="ri-email">${r.email}</span>
      <select onchange="updateUserRole('${r.id}',this.value)">
        <option value="admin" ${r.role==='admin'?'selected':''}>Admin</option>
        <option value="member" ${r.role==='member'?'selected':''}>Membro</option>
      </select>
      <button class="ri-del" onclick="removeUserRole('${r.id}')">🗑</button>
    </div>`).join('')||'<div style="font-size:12px;color:var(--text3);margin-bottom:8px">Nenhum usuário cadastrado ainda.</div>';
}
async function addUserRole(){
  const email=document.getElementById('role-new-email').value.trim();
  const pass=document.getElementById('role-new-pass')?.value.trim();
  const role=document.getElementById('role-new-role').value;
  if(!email){showToast('Informe o e-mail',true);return;}
  if(!pass||pass.length<6){showToast('Senha deve ter ao menos 6 caracteres',true);return;}
  const btn=document.getElementById('btn-add-user');
  btn.innerHTML='<span class="spinner spinner-dark"></span>';btn.disabled=true;

  // 1. Cria o usuário no Supabase Auth (signUp não faz logout se já houver sessão ativa no Supabase v2)
  const{data:signUpData,error:signUpErr}=await db.auth.signUp({email,password:pass});
  btn.innerHTML='+ Adicionar';btn.disabled=false;

  if(signUpErr&&!signUpErr.message?.includes('already registered')){
    showToast('Erro ao criar usuário: '+signUpErr.message,true);return;
  }

  // 2. Insere/atualiza a role
  const{data,error}=await db.from('user_roles').upsert({email,role},{onConflict:'email'}).select().single();
  if(error){showToast('Usuário criado mas erro ao salvar role',true);return;}

  const idx=USER_ROLES.findIndex(r=>r.email===email);
  if(idx>=0)USER_ROLES[idx]=data;else USER_ROLES.push(data);
  document.getElementById('role-new-email').value='';
  if(document.getElementById('role-new-pass'))document.getElementById('role-new-pass').value='';
  renderRolesList();

  const alreadyExisted=signUpErr?.message?.includes('already registered');
  showToast(alreadyExisted?`Role de "${email}" atualizada para ${role==='admin'?'Admin':'Membro'}!`:`Usuário "${email}" criado como ${role==='admin'?'Admin':'Membro'}!`);
}
async function updateUserRole(id,role){
  const{error}=await db.from('user_roles').update({role}).eq('id',id);
  if(error){showToast('Erro ao atualizar',true);return;}
  const r=USER_ROLES.find(x=>x.id===id);if(r)r.role=role;
  showToast('Função atualizada!');
}
async function removeUserRole(id){
  const r=USER_ROLES.find(x=>x.id===id);
  if(r?.email===curUser?.email){showToast('Você não pode remover seu próprio acesso',true);return;}
  const{error}=await db.from('user_roles').delete().eq('id',id);
  if(error){showToast('Erro ao remover',true);return;}
  USER_ROLES=USER_ROLES.filter(x=>x.id!==id);
  renderRolesList();
  showToast('Usuário removido');
}
function uploadSystemLogo(input){
  const file=input.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{systemLogoUrl=e.target.result;localStorage.setItem('panda_logo',e.target.result);updateLogoDisplays();document.getElementById('content').innerHTML=renderSettings();showToast('Logo atualizada!');};
  reader.readAsDataURL(file);
}
function removeSystemLogo(){systemLogoUrl=null;localStorage.removeItem('panda_logo');updateLogoDisplays();document.getElementById('content').innerHTML=renderSettings();showToast('Logo removida');}
function clearSavedSession(){localStorage.removeItem('panda_creds');document.getElementById('content').innerHTML=renderSettings();showToast('Sessão salva removida');}

// ═══════════════════════════════════════════════════
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