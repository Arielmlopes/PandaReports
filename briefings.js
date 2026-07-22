// ═══ BRIEFINGS — Formulário Público, Logos, Pedidos ═══
// PUBLIC BRIEFING FORM (sem login)
// ═══════════════════════════════════════════════════
async function initPublicForm(clientId){
  document.getElementById('scr-login').style.display='none';
  document.getElementById('sidebar').style.display='none';
  document.getElementById('main').style.display='none';
  document.getElementById('scr-public-form').style.display='block';
  const logoSaved=localStorage.getItem('panda_logo');
  if(logoSaved)systemLogoUrl=logoSaved;

  const{data:client,error}=await db.from('clients').select('*').eq('id',clientId).single();
  if(error||!client){
    document.getElementById('pf-wrap-content').innerHTML=`<div class="pf-header" style="margin-top:60px"><div class="pf-logo">🐼</div><h1>Link inválido</h1><p>Este formulário de pedido não foi encontrado. Confira o link com a agência.</p></div>`;
    return;
  }
  PF_CLIENT=client;
  const{data:orgs}=await db.from('org_logos').select('*').eq('client_id',clientId).order('name',{ascending:true});
  PF_ORGS=orgs||[];
  PF_STEP=1;
  renderPublicForm();
}

function pfHeaderHtml(){
  const logoHtml=systemLogoUrl?`<img src="${systemLogoUrl}">`:'🐼';
  return`<div class="pf-header">
    <div class="pf-logo">${logoHtml}</div>
    <h1>Solicitação de Material</h1>
    <p>${PF_CLIENT.name}</p>
  </div>
  <div class="pf-progress-wrap">
    <div class="pf-progress-label">Etapa ${PF_STEP} de ${PF_TOTAL_STEPS}</div>
    <div class="pf-progress-bar"><div class="pf-progress-fill" style="width:${(PF_STEP/PF_TOTAL_STEPS)*100}%"></div></div>
  </div>`;
}

function renderPublicForm(){
  const wrap=document.getElementById('pf-wrap-content');
  let stepHtml='';
  if(PF_STEP===1)stepHtml=pfStep1();
  else if(PF_STEP===2)stepHtml=pfStep2();
  else if(PF_STEP===3)stepHtml=pfStep3();
  else if(PF_STEP===4)stepHtml=pfStep4();
  else if(PF_STEP===5)stepHtml=pfStep5();
  else if(PF_STEP===6)stepHtml=pfStep6();
  wrap.innerHTML=pfHeaderHtml()+`<div class="pf-card">${stepHtml}</div>`;
  pfBindEvents();
}

function pfStep1(){
  return`
    <div class="pf-step-title">Quem está solicitando?</div>
    <div class="pf-step-sub">Precisamos saber quem fazer contato em caso de dúvidas.</div>
    <div class="pf-field" id="f-requester_name">
      <label>Seu nome <span class="req">*</span></label>
      <input type="text" id="pf-requester_name" value="${PF_DATA.requester_name}" placeholder="Ex: Maria Souza">
      <div class="pf-err-msg">Preencha seu nome.</div>
    </div>
    <div class="pf-field" id="f-requester_role">
      <label>Seu cargo / função <span class="req">*</span></label>
      <input type="text" id="pf-requester_role" value="${PF_DATA.requester_role}" placeholder="Ex: Recepcionista, Gerente, Sócio...">
      <div class="pf-err-msg">Preencha seu cargo ou função.</div>
    </div>
    <div class="pf-field" id="f-requester_contact">
      <label>Telefone ou e-mail para contato <span class="req">*</span></label>
      <input type="text" id="pf-requester_contact" value="${PF_DATA.requester_contact}" placeholder="Ex: (77) 99999-9999">
      <div class="pf-err-msg">Preencha um telefone ou e-mail.</div>
    </div>
    <div class="pf-nav"><button class="pf-btn pf-btn-next" onclick="pfNext()">Continuar →</button></div>`;
}

function pfStep2(){
  return`
    <div class="pf-step-title">Que tipo de material você precisa?</div>
    <div class="pf-step-sub">Escolha a opção que mais combina com o pedido.</div>
    <div class="pf-field" id="f-material_type">
      <div class="pf-card-grid">
        ${MAT_TYPES_PF.map(t=>`
          <div class="pf-card-opt ${PF_DATA.material_type===t.id?'sel':''}" onclick="pfSelectMatType('${t.id}')">
            <span class="pfc-ico">${t.emoji}</span>
            <span class="pfc-label">${t.label}</span>
          </div>`).join('')}
      </div>
      <div class="pf-err-msg" style="display:${PF_DATA.material_type?'none':'none'}">Selecione um tipo de material.</div>
    </div>
    ${PF_DATA.material_type==='other'?`
    <div class="pf-field" id="f-material_type_other">
      <label>Descreva o tipo de material <span class="req">*</span></label>
      <input type="text" id="pf-material_type_other" value="${PF_DATA.material_type_other}" placeholder="Ex: Faixa para evento">
      <div class="pf-err-msg">Descreva o tipo de material.</div>
    </div>`:''}
    ${PF_DATA.material_type==='carousel'?`
    <div class="pf-hint">💡 No próximo passo você pode indicar a quantidade aproximada de slides na descrição.</div>`:''}
    ${(PF_DATA.material_type==='video')?`
    <div class="pf-hint">💡 No próximo passo, conte a ideia ou roteiro do vídeo na descrição.</div>`:''}
    <div class="pf-nav">
      <button class="pf-btn pf-btn-prev" onclick="pfPrev()">← Voltar</button>
      <button class="pf-btn pf-btn-next" onclick="pfNext()">Continuar →</button>
    </div>`;
}

function pfStep3(){
  return`
    <div class="pf-step-title">Sobre o conteúdo</div>
    <div class="pf-step-sub">Conte os detalhes do que precisa ser feito.</div>
    <div class="pf-field" id="f-event_title">
      <label>Nome do material ou evento <span class="req">*</span></label>
      <input type="text" id="pf-event_title" value="${PF_DATA.event_title}" placeholder="Ex: Promoção de aniversário, Campanha de Verão...">
      <div class="pf-err-msg">Preencha o nome do material ou evento.</div>
    </div>
    <div class="pf-field">
      <label>Tem data de evento ou publicação?</label>
      <div class="pf-toggle-row">
        <div class="pf-toggle-btn ${PF_DATA.has_date?'sel':''}" onclick="pfToggleHasDate(true)">Sim</div>
        <div class="pf-toggle-btn ${!PF_DATA.has_date?'sel':''}" onclick="pfToggleHasDate(false)">Não</div>
      </div>
    </div>
    ${PF_DATA.has_date?`
    <div class="pf-field" id="f-event_date">
      <label>Data <span class="req">*</span></label>
      <input type="date" id="pf-event_date" value="${PF_DATA.event_date}">
      <div class="pf-err-msg">Selecione a data.</div>
    </div>
    <div class="pf-field">
      <label>Horário <span class="opt">opcional</span></label>
      <input type="time" id="pf-event_time" value="${PF_DATA.event_time}">
    </div>`:''}
    <div class="pf-field" id="f-description">
      <label>O que precisa estar no material? <span class="req">*</span></label>
      <textarea id="pf-description" placeholder="Explique o que precisa aparecer: dia, horário, local, valores, contato, texto que deve estar na arte, etc.">${PF_DATA.description}</textarea>
      <div class="pf-charcount" id="pf-desc-count">${PF_DATA.description.length} caracteres (mín. 20)</div>
      <div class="pf-err-msg">Descreva com mais detalhes (mínimo 20 caracteres).</div>
    </div>
    <div class="pf-field" id="f-objective">
      <label>Qual o objetivo do material? <span class="req">*</span></label>
      <select id="pf-objective">
        <option value="">Selecione...</option>
        ${OBJ_OPTIONS.map(o=>`<option value="${o}" ${PF_DATA.objective===o?'selected':''}>${o}</option>`).join('')}
      </select>
      <div class="pf-err-msg">Selecione o objetivo.</div>
    </div>
    <div class="pf-field">
      <label>Nível de urgência</label>
      <div class="pf-toggle-row">
        <div class="pf-toggle-btn ${PF_DATA.urgency==='Normal'?'sel':''}" onclick="pfSetUrgency('Normal')">Normal</div>
        <div class="pf-toggle-btn ${PF_DATA.urgency==='Urgente'?'sel':''}" onclick="pfSetUrgency('Urgente')">Urgente</div>
      </div>
      ${PF_DATA.urgency==='Urgente'?`
      <div class="pf-urgent-box">
        <label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:#f87171">Por que é urgente? <span class="req">*</span></label>
        <textarea id="pf-urgency_reason" style="min-height:60px" placeholder="Explique o motivo da urgência">${PF_DATA.urgency_reason}</textarea>
        <div class="pf-err-msg" id="err-urgency">Explique o motivo da urgência.</div>
      </div>`:''}
    </div>
    <div class="pf-nav">
      <button class="pf-btn pf-btn-prev" onclick="pfPrev()">← Voltar</button>
      <button class="pf-btn pf-btn-next" onclick="pfNext()">Continuar →</button>
    </div>`;
}

function pfStep4(){
  return`
    <div class="pf-step-title">Identidade visual</div>
    <div class="pf-step-sub">Selecione quais logos devem aparecer no material.</div>
    <div class="pf-field" id="f-selected_logos">
      ${PF_ORGS.length===0?'<div class="pf-logo-empty">Nenhuma logo cadastrada ainda para este cliente.</div>':`
      <div class="pf-logo-grid">
        ${PF_ORGS.map(o=>`
          <div class="pf-logo-opt ${PF_DATA.selected_logos.includes(o.id)?'sel':''}" onclick="pfToggleLogo('${o.id}')">
            ${o.logo_url?`<img src="${o.logo_url}">`:`<div class="pflo-ph">🏛</div>`}
            <div class="pflo-name">${o.name}</div>
          </div>`).join('')}
      </div>`}
      <div class="pf-err-msg">Selecione ao menos uma logo ou descreva abaixo.</div>
    </div>
    <div class="pf-field">
      <label>Logo não está na lista? <span class="opt">opcional</span></label>
      <input type="text" id="pf-logo_other_desc" value="${PF_DATA.logo_other_desc}" placeholder="Descreva qual órgão/logo é necessário">
      <div class="logo-upload-box" onclick="document.getElementById('pf-logo-other-input').click()" id="pf-logo-other-box" style="margin-top:8px">
        ${PF_DATA.logo_other_url?`<img src="${PF_DATA.logo_other_url}" class="logo-preview"><div style="font-size:11px;color:var(--text3)">Clique para alterar</div>`:'<div style="font-size:22px;margin-bottom:4px">📎</div><div style="font-size:11px;color:var(--text3)">Anexar logo (opcional)</div>'}
      </div>
      <input type="file" id="pf-logo-other-input" accept="image/*" style="display:none" onchange="pfPreviewOtherLogo(this)">
    </div>
    <div class="pf-nav">
      <button class="pf-btn pf-btn-prev" onclick="pfPrev()">← Voltar</button>
      <button class="pf-btn pf-btn-next" onclick="pfNext()">Continuar →</button>
    </div>`;
}

function pfStep5(){
  return`
    <div class="pf-step-title">Referências (opcional)</div>
    <div class="pf-step-sub">Fotos do evento, referência visual ou documentos que ajudem na produção.</div>
    <div class="pf-field">
      <label>Anexos <span class="opt">opcional</span></label>
      <div class="pf-dz" id="pf-dropzone" onclick="document.getElementById('pf-file-input').click()" ondragover="pfDragOver(event)" ondragleave="pfDragLeave(event)" ondrop="pfDrop(event)">
        <div class="pfdz-ico">☁</div>
        <p>Arraste arquivos ou clique para selecionar</p>
        <span>Fotos, documentos, referências visuais</span>
      </div>
      <input type="file" id="pf-file-input" multiple accept="image/*,video/*,application/pdf" style="display:none" onchange="pfFileSelect(this)">
      <div class="pf-dz-files" id="pf-dz-files"></div>
    </div>
    <div class="pf-field">
      <label>Link de referência <span class="opt">opcional</span></label>
      <input type="text" id="pf-reference_link" value="${PF_DATA.reference_link}" placeholder="Ex: link do edital, site, etc.">
    </div>
    <div class="pf-nav">
      <button class="pf-btn pf-btn-prev" onclick="pfPrev()">← Voltar</button>
      <button class="pf-btn pf-btn-next" onclick="pfNext()">Revisar pedido →</button>
    </div>`;
}

function pfStep6(){
  const mt=MAT_TYPES_PF.find(t=>t.id===PF_DATA.material_type);
  const logosNames=PF_DATA.selected_logos.map(id=>PF_ORGS.find(o=>o.id===id)?.name).filter(Boolean);
  return`
    <div class="pf-step-title">Revise seu pedido</div>
    <div class="pf-step-sub">Confira tudo antes de enviar.</div>
    <div class="pf-review-block">
      <h4>Solicitante</h4>
      <div class="pf-review-row"><span class="rl">Nome</span><span class="rv">${PF_DATA.requester_name}</span></div>
      <div class="pf-review-row"><span class="rl">Setor</span><span class="rv">${PF_DATA.requester_role}</span></div>
      <div class="pf-review-row"><span class="rl">Contato</span><span class="rv">${PF_DATA.requester_contact}</span></div>
    </div>
    <div class="pf-review-block">
      <h4>Material</h4>
      <div class="pf-review-row"><span class="rl">Tipo</span><span class="rv">${mt?.emoji||''} ${mt?.label||''}${PF_DATA.material_type==='other'?' — '+PF_DATA.material_type_other:''}</span></div>
      <div class="pf-review-row"><span class="rl">Título</span><span class="rv">${PF_DATA.event_title}</span></div>
      ${PF_DATA.has_date?`<div class="pf-review-row"><span class="rl">Data</span><span class="rv">${PF_DATA.event_date}${PF_DATA.event_time?' às '+PF_DATA.event_time:''}</span></div>`:''}
      <div class="pf-review-row"><span class="rl">Objetivo</span><span class="rv">${PF_DATA.objective}</span></div>
      <div class="pf-review-row"><span class="rl">Urgência</span><span class="rv">${PF_DATA.urgency}</span></div>
    </div>
    <div class="pf-review-block">
      <h4>Descrição</h4>
      <div class="pf-review-desc">${PF_DATA.description}</div>
    </div>
    <div class="pf-review-block">
      <h4>Identidade visual</h4>
      <div class="pf-review-desc">${logosNames.length?logosNames.join(', '):''}${PF_DATA.logo_other_desc?(logosNames.length?' + ':'')+PF_DATA.logo_other_desc:''}${!logosNames.length&&!PF_DATA.logo_other_desc?'Nenhuma':''}</div>
    </div>
    ${(PF_REF_FILES.length||PF_DATA.reference_link)?`
    <div class="pf-review-block">
      <h4>Referências</h4>
      ${PF_REF_FILES.length?`<div class="pf-review-desc">${PF_REF_FILES.length} arquivo(s) anexado(s)</div>`:''}
      ${PF_DATA.reference_link?`<div class="pf-review-desc">${PF_DATA.reference_link}</div>`:''}
    </div>`:''}
    <div class="pf-nav">
      <button class="pf-btn pf-btn-prev" onclick="pfPrev()">← Voltar</button>
      <button class="pf-btn pf-btn-next" id="pf-submit-btn" onclick="pfSubmit()">Confirmar e Enviar ✓</button>
    </div>`;
}

function pfBindEvents(){
  const desc=document.getElementById('pf-description');
  if(desc)desc.addEventListener('input',()=>{document.getElementById('pf-desc-count').textContent=`${desc.value.length} caracteres (mín. 20)`;});
}
function pfSelectMatType(id){pfCollectStepValues();PF_DATA.material_type=id;renderPublicForm();}
function pfToggleHasDate(v){pfCollectStepValues();PF_DATA.has_date=v;renderPublicForm();}
function pfSetUrgency(v){pfCollectStepValues();PF_DATA.urgency=v;renderPublicForm();}
function pfToggleLogo(id){
  const i=PF_DATA.selected_logos.indexOf(id);
  if(i>=0)PF_DATA.selected_logos.splice(i,1);else PF_DATA.selected_logos.push(id);
  renderPublicForm();
}
function pfPreviewOtherLogo(input){
  const file=input.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{PF_DATA.logo_other_url=e.target.result;renderPublicForm();};
  reader.readAsDataURL(file);
}
function pfDragOver(e){e.preventDefault();document.getElementById('pf-dropzone').classList.add('drag');}
function pfDragLeave(){document.getElementById('pf-dropzone').classList.remove('drag');}
function pfDrop(e){e.preventDefault();document.getElementById('pf-dropzone').classList.remove('drag');pfHandleFiles(e.dataTransfer.files);}
function pfFileSelect(inp){pfHandleFiles(inp.files);inp.value='';}
function pfHandleFiles(files){
  Array.from(files).slice(0,15).forEach(f=>{PF_REF_FILES.push({file:f,name:f.name});});
  renderPfDzFiles();
}
function renderPfDzFiles(){
  const el=document.getElementById('pf-dz-files');if(!el)return;
  el.innerHTML=PF_REF_FILES.map((f,i)=>`<div class="pf-dz-file"><span>📎</span><span class="fn">${f.name}</span><span class="rm" onclick="pfRemoveFile(${i})">×</span></div>`).join('');
}
function pfRemoveFile(i){PF_REF_FILES.splice(i,1);renderPfDzFiles();}

function pfCollectStepValues(){
  if(PF_STEP===1){
    PF_DATA.requester_name=document.getElementById('pf-requester_name')?.value.trim()||'';
    PF_DATA.requester_role=document.getElementById('pf-requester_role')?.value.trim()||'';
    PF_DATA.requester_contact=document.getElementById('pf-requester_contact')?.value.trim()||'';
  }else if(PF_STEP===2){
    if(PF_DATA.material_type==='other')PF_DATA.material_type_other=document.getElementById('pf-material_type_other')?.value.trim()||'';
  }else if(PF_STEP===3){
    PF_DATA.event_title=document.getElementById('pf-event_title')?.value.trim()||'';
    if(PF_DATA.has_date){
      PF_DATA.event_date=document.getElementById('pf-event_date')?.value||'';
      PF_DATA.event_time=document.getElementById('pf-event_time')?.value||'';
    }
    PF_DATA.description=document.getElementById('pf-description')?.value.trim()||'';
    PF_DATA.objective=document.getElementById('pf-objective')?.value||'';
    if(PF_DATA.urgency==='Urgente')PF_DATA.urgency_reason=document.getElementById('pf-urgency_reason')?.value.trim()||'';
  }else if(PF_STEP===4){
    PF_DATA.logo_other_desc=document.getElementById('pf-logo_other_desc')?.value.trim()||'';
  }else if(PF_STEP===5){
    PF_DATA.reference_link=document.getElementById('pf-reference_link')?.value.trim()||'';
  }
}

function pfValidateStep(){
  let valid=true;
  document.querySelectorAll('.pf-field').forEach(f=>f.classList.remove('pf-invalid'));
  function mark(id){const f=document.getElementById('f-'+id);if(f)f.classList.add('pf-invalid');valid=false;}

  if(PF_STEP===1){
    if(!PF_DATA.requester_name)mark('requester_name');
    if(!PF_DATA.requester_role)mark('requester_role');
    if(!PF_DATA.requester_contact)mark('requester_contact');
  }else if(PF_STEP===2){
    if(!PF_DATA.material_type){showToast('Selecione um tipo de material',true);valid=false;}
    if(PF_DATA.material_type==='other'&&!PF_DATA.material_type_other)mark('material_type_other');
  }else if(PF_STEP===3){
    if(!PF_DATA.event_title)mark('event_title');
    if(PF_DATA.has_date&&!PF_DATA.event_date)mark('event_date');
    if(!PF_DATA.description||PF_DATA.description.length<20)mark('description');
    if(!PF_DATA.objective)mark('objective');
    if(PF_DATA.urgency==='Urgente'&&!PF_DATA.urgency_reason){
      const box=document.getElementById('err-urgency');if(box)box.style.display='block';valid=false;
    }
  }else if(PF_STEP===4){
    if(PF_DATA.selected_logos.length===0&&!PF_DATA.logo_other_desc&&!PF_DATA.logo_other_url){
      const f=document.getElementById('f-selected_logos');if(f)f.classList.add('pf-invalid');valid=false;
    }
  }
  return valid;
}

function pfNext(){
  pfCollectStepValues();
  if(!pfValidateStep()){showToast('Preencha os campos obrigatórios',true);return;}
  if(PF_STEP<PF_TOTAL_STEPS){PF_STEP++;renderPublicForm();window.scrollTo(0,0);}
}
function pfPrev(){
  pfCollectStepValues();
  if(PF_STEP>1){PF_STEP--;renderPublicForm();window.scrollTo(0,0);}
}

function pfGenerateProtocol(){
  const d=new Date();
  const ymd=`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  const rand=Math.floor(1000+Math.random()*9000);
  return`PED-${ymd}-${rand}`;
}

async function pfSubmit(){
  const btn=document.getElementById('pf-submit-btn');
  btn.innerHTML='<span class="spinner spinner-dark"></span> Enviando…';btn.disabled=true;
  try{
    const protocol=pfGenerateProtocol();
    let logoOtherUrl=null;
    if(PF_DATA.logo_other_url){
      const blob=dataURLtoBlob(PF_DATA.logo_other_url);
      const path=`briefings/${PF_CLIENT.id}/${protocol}/logo_other.jpg`;
      const{error:upErr}=await db.storage.from(BUCKET).upload(path,blob,{upsert:true,contentType:'image/jpeg'});
      if(!upErr){const{data:ud}=db.storage.from(BUCKET).getPublicUrl(path);logoOtherUrl=ud.publicUrl;}
    }
    const refFiles=[];
    for(const f of PF_REF_FILES){
      const path=`briefings/${PF_CLIENT.id}/${protocol}/${Date.now()}_${safeFileName(f.name)}`;
      const{error:upErr}=await db.storage.from(BUCKET).upload(path,f.file,{upsert:true});
      if(!upErr){const{data:ud}=db.storage.from(BUCKET).getPublicUrl(path);refFiles.push({name:f.name,url:ud.publicUrl});}
    }
    const{data:newBriefing,error}=await db.from('briefings').insert({
      client_id:PF_CLIENT.id,protocol,
      requester_name:PF_DATA.requester_name,requester_role:PF_DATA.requester_role,requester_contact:PF_DATA.requester_contact,
      material_type:PF_DATA.material_type,material_type_other:PF_DATA.material_type_other,
      event_title:PF_DATA.event_title,has_date:PF_DATA.has_date,event_date:PF_DATA.has_date?PF_DATA.event_date||null:null,event_time:PF_DATA.event_time||null,
      description:PF_DATA.description,objective:PF_DATA.objective,urgency:PF_DATA.urgency,urgency_reason:PF_DATA.urgency_reason,
      selected_logos:PF_DATA.selected_logos,logo_other_desc:PF_DATA.logo_other_desc,logo_other_url:logoOtherUrl,
      reference_files:refFiles,reference_link:PF_DATA.reference_link,status:'Recebido - Aguardando producao'
    }).select().single();
    if(error)throw error;
    // cria automaticamente o card no quadro Kanban (coluna Pedidos Clientes)
    try{
      const{data:pedCol}=await db.from('kanban_columns').select('id').eq('slug','pedidos_clientes').single();
      const cardAttachments=refFiles.map(f=>({name:f.name,url:f.url,ft:/\.(mp4|mov|avi|webm)$/i.test(f.name)?'video':'image'}));
      await db.from('kanban_cards').insert({
        client_id:PF_CLIENT.id,column_id:pedCol?.id||'pedidos_clientes',
        title:PF_DATA.event_title,description:PF_DATA.description,
        attachments:cardAttachments,source_briefing_id:newBriefing.id
      });
    }catch(kbErr){console.error('Erro ao criar card no Kanban:',kbErr);}
    pfRenderSuccess(protocol);
  }catch(e){
    console.error(e);showToast('Erro ao enviar pedido. Tente novamente.',true);
    btn.innerHTML='Confirmar e Enviar ✓';btn.disabled=false;
  }
}

function pfRenderSuccess(protocol){
  const wrap=document.getElementById('pf-wrap-content');
  const logoHtml=systemLogoUrl?`<img src="${systemLogoUrl}">`:'🐼';
  wrap.innerHTML=`
    <div class="pf-header"><div class="pf-logo">${logoHtml}</div></div>
    <div class="pf-card">
      <div class="pf-success">
        <div class="pfs-ico">✓</div>
        <h2>Pedido enviado com sucesso!</h2>
        <p>Recebemos sua solicitação e nossa equipe vai começar a produção. Guarde o número de protocolo abaixo para acompanhamento.</p>
        <div class="pf-protocol">
          <div class="pfp-label">Número do protocolo</div>
          <div class="pfp-code">${protocol}</div>
        </div>
        <button class="pf-btn pf-btn-next" style="width:100%" onclick="location.reload()">Fazer novo pedido</button>
      </div>
    </div>`;
}

// ═══════════════════════════════════════════════════
// ORG LOGOS (gestão admin, por cliente)
// ═══════════════════════════════════════════════════
async function openOrgLogosModal(){
  if(!curClient)return;
  await loadOrgLogos(curClient.id);
  document.getElementById('org-name-input').value='';
  document.getElementById('org-logo-data').value='';
  curOrgLogoData=null;
  document.getElementById('org-logo-box').innerHTML='<div style="font-size:24px;margin-bottom:5px">🏛</div><div style="font-size:11px;color:var(--text3)">Clique para enviar a logo (opcional)</div>';
  const shareUrl=`${location.origin}${location.pathname}?form=${curClient.id}`;
  document.getElementById('share-link-input').value=shareUrl;
  openOv('ov-org-logos');
}
async function loadOrgLogos(clientId){
  const{data,error}=await db.from('org_logos').select('*').eq('client_id',clientId).order('name',{ascending:true});
  ORG_LOGOS_CACHE[clientId]=error?[]:(data||[]);
  renderOrgList();
}
function renderOrgList(){
  const list=ORG_LOGOS_CACHE[curClient?.id]||[];
  document.getElementById('org-list').innerHTML=list.map(o=>`
    <div class="org-item">
      ${o.logo_url?`<img src="${o.logo_url}">`:'<div class="org-ph">🏛</div>'}
      <span class="org-name">${o.name}</span>
      <button class="org-del" onclick="deleteOrgLogo('${o.id}')">🗑</button>
    </div>`).join('')||'<div style="font-size:12px;color:var(--text3);padding:8px 0">Nenhum órgão cadastrado ainda.</div>';
}
function previewOrgLogo(input){
  const file=input.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    curOrgLogoData=e.target.result;
    document.getElementById('org-logo-data').value=e.target.result;
    document.getElementById('org-logo-box').innerHTML=`<img src="${e.target.result}" class="logo-preview"><div style="font-size:11px;color:var(--text3)">Clique para alterar</div>`;
  };
  reader.readAsDataURL(file);
}
async function submitNewOrg(){
  const name=document.getElementById('org-name-input').value.trim();
  if(!name){showToast('Informe o nome do órgão',true);return;}
  const btn=document.getElementById('btn-add-org');
  btn.innerHTML='<span class="spinner"></span>';btn.disabled=true;
  let logoUrl=null;
  const logoData=document.getElementById('org-logo-data').value;
  if(logoData){
    const blob=dataURLtoBlob(logoData);
    const path=`org-logos/${curClient.id}_${Date.now()}.jpg`;
    const{error:upErr}=await db.storage.from(BUCKET).upload(path,blob,{upsert:true,contentType:'image/jpeg'});
    if(!upErr){const{data:ud}=db.storage.from(BUCKET).getPublicUrl(path);logoUrl=ud.publicUrl;}
  }
  const{data,error}=await db.from('org_logos').insert({client_id:curClient.id,name,logo_url:logoUrl}).select().single();
  btn.innerHTML='+ Adicionar órgão';btn.disabled=false;
  if(error){showToast('Erro ao adicionar órgão',true);return;}
  if(!ORG_LOGOS_CACHE[curClient.id])ORG_LOGOS_CACHE[curClient.id]=[];
  ORG_LOGOS_CACHE[curClient.id].push(data);
  renderOrgList();
  document.getElementById('org-name-input').value='';
  document.getElementById('org-logo-data').value='';
  document.getElementById('org-logo-box').innerHTML='<div style="font-size:24px;margin-bottom:5px">🏛</div><div style="font-size:11px;color:var(--text3)">Clique para enviar a logo (opcional)</div>';
  showToast(`"${name}" adicionado!`);
}
async function deleteOrgLogo(id){
  const{error}=await db.from('org_logos').delete().eq('id',id);
  if(error){showToast('Erro ao excluir',true);return;}
  ORG_LOGOS_CACHE[curClient.id]=(ORG_LOGOS_CACHE[curClient.id]||[]).filter(o=>o.id!==id);
  renderOrgList();showToast('Órgão removido');
}
function copyShareLink(){
  const input=document.getElementById('share-link-input');
  input.select();
  navigator.clipboard.writeText(input.value).then(()=>showToast('Link copiado!')).catch(()=>{document.execCommand('copy');showToast('Link copiado!');});
}

// ═══════════════════════════════════════════════════
// PEDIDOS (admin briefing inbox)
// ═══════════════════════════════════════════════════
async function loadBriefings(){
  const{data,error}=await db.from('briefings').select('*').order('created_at',{ascending:false});
  if(error){BRIEFINGS=[];updatePedidosBadge();return;}
  BRIEFINGS=data||[];updatePedidosBadge();
}
function updatePedidosBadge(){
  const pending=BRIEFINGS.filter(b=>b.status==='Recebido - Aguardando producao').length;
  const badge=document.getElementById('kanban-badge');
  if(!badge)return;
  if(pending>0){badge.textContent=pending;badge.style.display='inline-block';}
  else badge.style.display='none';
}
function renderPedCard(b){
  const st=STATUS_OPTIONS.find(s=>s.id===b.status)||STATUS_OPTIONS[0];
  const mt=MAT_TYPES_PF.find(t=>t.id===b.material_type);
  return`
    <div class="ped-card" onclick="openPedDetail('${b.id}')">
      <div class="ped-card-top">
        <div>
          <div class="ped-title">${mt?.emoji||''} ${b.event_title}</div>
          <div class="ped-meta">${b.requester_name} · ${fmtDateS(b.created_at.split('T')[0])} · ${b.protocol}</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
          ${b.urgency==='Urgente'?'<span class="ped-urgent-tag">Urgente</span>':''}
          <span class="ped-status ${st.cls}">${st.label}</span>
        </div>
      </div>
      <div class="ped-desc-preview">${b.description}</div>
    </div>`;
}
function openPedDetail(id){
  const b=BRIEFINGS.find(x=>x.id===id);if(!b)return;
  const client=CLIENTS.find(c=>c.id===b.client_id);
  const mt=MAT_TYPES_PF.find(t=>t.id===b.material_type);
  document.getElementById('ped-detail-title').textContent=`${b.protocol} — ${b.event_title}`;
  const logosNames=(b.selected_logos||[]).map(lid=>(ORG_LOGOS_CACHE[b.client_id]||[]).find(o=>o.id===lid)?.name).filter(Boolean);
  const ficha=pfBuildFicha(b,client,mt,logosNames);
  const st=STATUS_OPTIONS.find(s=>s.id===b.status)||STATUS_OPTIONS[0];
  const linkedCard=KANBAN_CARDS.find(c=>c.source_briefing_id===b.id);
  document.getElementById('ped-detail-body').innerHTML=`
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
      <span class="ped-status ${st.cls}">${st.label}</span>
      ${b.urgency==='Urgente'?'<span class="ped-urgent-tag">Urgente</span>':''}
    </div>
    ${b.status==='Recebido - Aguardando producao'?`
      <button class="btn btn-green" style="width:100%;justify-content:center;margin-bottom:10px" onclick="updatePedStatus('${b.id}','Em producao')">✓ Aceitar pedido</button>
    `:''}
    <button class="btn btn-indigo" style="width:100%;justify-content:center;margin-bottom:14px" onclick="openLinkedKbCard('${b.id}')">🗂 Abrir no Fluxo${b.status==='Concluido'?' (Concluído)':''}</button>
    <div style="font-size:11px;color:var(--text3);text-align:center;margin-top:-8px;margin-bottom:14px">Esta área é só para acompanhar e aceitar pedidos. A finalização (envio pra Materiais) acontece no Fluxo, evitando demanda duplicada.</div>
    <div class="ficha-box" id="ficha-text-${b.id}">${ficha}</div>
    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="btn btn-green" style="flex:1;justify-content:center" onclick="copyFicha('${b.id}')">📋 Copiar ficha</button>
    </div>
    ${(b.reference_files&&b.reference_files.length)?`
      <div style="margin-top:14px">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--text3);font-weight:700;margin-bottom:8px">Anexos do pedido</div>
        <div style="display:flex;flex-wrap:wrap;gap:7px">
          ${b.reference_files.map(f=>`<a href="${f.url}" target="_blank" style="font-size:12px;padding:6px 11px;background:var(--bg3);border:1px solid var(--border);border-radius:7px;color:var(--text2);text-decoration:none">📎 ${f.name}</a>`).join('')}
        </div>
      </div>`:''}
  `;
  if(!ORG_LOGOS_CACHE[b.client_id]){
    loadOrgLogos(b.client_id).then(()=>{
      if(document.getElementById('ov-ped-detail').classList.contains('open'))openPedDetail(id);
    });
  }
  openOv('ov-ped-detail');
}
async function openLinkedKbCard(briefingId){
  closeOv('ov-ped-detail');
  await showScreen('kanban');
  const card=KANBAN_CARDS.find(c=>c.source_briefing_id===briefingId);
  if(card)openKbCardDetail(card.id);
  else showToast('Card não encontrado no Fluxo',true);
}
function pfBuildFicha(b,client,mt,logosNames){
  const lines=[];
  lines.push(`FICHA DE PEDIDO — ${b.protocol}`);
  lines.push(`Cliente: ${client?.name||'—'}`);
  lines.push(`Data do pedido: ${new Date(b.created_at).toLocaleDateString('pt-BR')}`);
  lines.push('');
  lines.push(`SOLICITANTE`);
  lines.push(`Nome: ${b.requester_name}`);
  lines.push(`Cargo/função: ${b.requester_role}`);
  lines.push(`Contato: ${b.requester_contact}`);
  lines.push('');
  lines.push(`MATERIAL`);
  lines.push(`Tipo: ${mt?.label||b.material_type}${b.material_type==='other'?' — '+b.material_type_other:''}`);
  lines.push(`Título/Evento: ${b.event_title}`);
  if(b.has_date)lines.push(`Data: ${b.event_date}${b.event_time?' às '+b.event_time:''}`);
  lines.push(`Objetivo: ${b.objective}`);
  lines.push(`Urgência: ${b.urgency}${b.urgency==='Urgente'?' — '+b.urgency_reason:''}`);
  lines.push('');
  lines.push(`DESCRIÇÃO`);
  lines.push(b.description);
  lines.push('');
  lines.push(`IDENTIDADE VISUAL`);
  lines.push(`Logos: ${logosNames.length?logosNames.join(', '):'—'}`);
  if(b.logo_other_desc)lines.push(`Outra logo solicitada: ${b.logo_other_desc}`);
  if(b.reference_link){lines.push('');lines.push(`Link de referência: ${b.reference_link}`);}
  lines.push('');
  lines.push(`Status: ${STATUS_OPTIONS.find(s=>s.id===b.status)?.label||b.status}`);
  return lines.join('\n');
}
function copyFicha(id){
  const el=document.getElementById(`ficha-text-${id}`);
  if(!el)return;
  navigator.clipboard.writeText(el.textContent).then(()=>showToast('Ficha copiada!')).catch(()=>showToast('Erro ao copiar',true));
}
async function updatePedStatus(id,status){
  const{error}=await db.from('briefings').update({status}).eq('id',id);
  if(error){showToast('Erro ao atualizar status',true);return;}
  const b=BRIEFINGS.find(x=>x.id===id);if(b)b.status=status;
  updatePedidosBadge();
  if(curClient&&b&&curClient.id===b.client_id&&clientTab==='pedidos')switchClientTab('pedidos');
  openPedDetail(id);
  showToast('Status atualizado!');
}

// ═══════════════════════════════════════════════════
