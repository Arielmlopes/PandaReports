// ═══ SETTINGS — Configurações, Usuários, Roles ═══
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
