p:7px">
          ${b.reference_files.map(f=>`<a href="${f.url}" target="_blank" style="font-size:12px;padding:6px 11px;background:var(--bg3);border:1px solid var(--border);border-radius:7px;color:var(--text2);text-decoration:none">ðŸ“Ž ${f.name}</a>`).join('')}
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
  else showToast('Card nÃ£o encontrado no Fluxo',true);
}
function pfBuildFicha(b,client,mt,logosNames){
  const lines=[];
  lines.push(`FICHA DE PEDIDO â€” ${b.protocol}`);
  lines.push(`Cliente: ${client?.name||'â€”'}`);
  lines.push(`Data do pedido: ${new Date(b.created_at).toLocaleDateString('pt-BR')}`);
  lines.push('');
  lines.push(`SOLICITANTE`);
  lines.push(`Nome: ${b.requester_name}`);
  lines.push(`Cargo/funÃ§Ã£o: ${b.requester_role}`);
  lines.push(`Contato: ${b.requester_contact}`);
  lines.push('');
  lines.push(`MATERIAL`);
  lines.push(`Tipo: ${mt?.label||b.material_type}${b.material_type==='other'?' â€” '+b.material_type_other:''}`);
  lines.push(`TÃ­tulo/Evento: ${b.event_title}`);
  if(b.has_date)lines.push(`Data: ${b.event_date}${b.event_time?' Ã s '+b.event_time:''}`);
  lines.push(`Objetivo: ${b.objective}`);
  lines.push(`UrgÃªncia: ${b.urgency}${b.urgency==='Urgente'?' â€” '+b.urgency_reason:''}`);
  lines.push('');
  lines.push(`DESCRIÃ‡ÃƒO`);
  lines.push(b.description);
  lines.push('');
  lines.push(`IDENTIDADE VISUAL`);
  lines.push(`Logos: ${logosNames.length?logosNames.join(', '):'â€”'}`);
  if(b.logo_other_desc)lines.push(`Outra logo solicitada: ${b.logo_other_desc}`);
  if(b.reference_link){lines.push('');lines.push(`Link de referÃªncia: ${b.reference_link}`);}
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// KANBAN BOARD (Fluxo)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
async function loadKanbanColumns(){
  const{data,error}=await db.from('kanban_columns').select('*').order('position',{ascending:true});
  KANBAN_COLUMNS=(error||!data||data.length===0)?KANBAN_COLUMNS_FALLBACK.slice():data;
}
async function loadKanbanCards(){
  const{data,error}=await db.from('kanban_cards').select('*').order('created_at',{ascending:true});
  KANBAN_CARDS=error?[]:(data||[]);
}
function kanbanFilteredCards(colId){
  return KANBAN_CARDS
    .filter(c=>c.column_id===colId&&(kanbanClientFilter==='all'||c.client_id===kanbanClientFilter))
    .sort((a,b)=>(a.position??0)-(b.position??0));
}
function renderKanbanScreen(){
  return`
    <div class="kb-toolbar">
      <select onchange="kanbanClientFilter=this.value;renderKanbanBoardOnly()">
        <option value="all">Todos os clientes</option>
        ${CLIENTS.map(c=>`<option value="${c.id}" ${kanbanClientFilter===c.id?'selected':''}>${c.name}</option>`).join('')}
      </select>
      <button class="btn btn-green btn-sm" onclick="openNewKbCardModal()">+ Nova demanda</button>
      <span style="font-size:11px;color:var(--text3);margin-left:auto">ðŸ’¡ Arraste os cards entre listas, e arraste o cabeÃ§alho das listas para reordenar</span>
    </div>
    <div class="kb-board" id="kb-board">
      ${KANBAN_COLUMNS.map(col=>renderKbColumn(col)).join('')}
      ${renderAddColumnBox()}
    </div>`;
}
function renderKanbanBoardOnly(){
  const board=document.getElementById('kb-board');
  if(board)board.innerHTML=KANBAN_COLUMNS.map(col=>renderKbColumn(col)).join('')+renderAddColumnBox();
  setupKanbanDnD();
}
function renderAddColumnBox(){
  return`
    <div class="kb-col" style="background:transparent;border-style:dashed;display:flex;align-items:flex-start" id="kb-add-col-box">
      <div id="kb-add-col-inner" style="padding:12px;width:100%">
        <div class="kb-col-add" style="border:none" onclick="openAddColumnComposer()">+ Adicionar lista</div>
      </div>
    </div>`;
}
function openAddColumnComposer(){
  document.getElementById('kb-add-col-inner').innerHTML=`
    <input type="text" id="new-col-name" placeholder="Nome da lista" style="width:100%;padding:8px 10px;background:var(--bg3);border:1px solid var(--border2);border-radius:7px;color:var(--text);font-size:13px;font-family:inherit;outline:none;margin-bottom:7px" onkeydown="if(event.key==='Enter')submitNewColumn()">
    <div style="display:flex;gap:6px">
      <button class="btn btn-green btn-sm" onclick="submitNewColumn()">Adicionar</button>
      <button class="btn btn-ghost btn-sm" onclick="renderKanbanBoardOnly()">Cancelar</button>
    </div>`;
  setTimeout(()=>document.getElementById('new-col-name')?.focus(),50);
}
async function submitNewColumn(){
  const input=document.getElementById('new-col-name');
  const label=input.value.trim();
  if(!label){showToast('Informe o nome da lista',true);return;}
  const color=COL_PALETTE[KANBAN_COLUMNS.length%COL_PALETTE.length];
  const position=KANBAN_COLUMNS.length;
  const{data,error}=await db.from('kanban_columns').insert({label,color,position}).select().single();
  if(error){showToast('Erro ao criar lista',true);return;}
  KANBAN_COLUMNS.push(data);
  renderKanbanBoardOnly();
  showToast(`Lista "${label}" criada!`);
}
function startRenameColumn(colId){
  const col=KANBAN_COLUMNS.find(c=>c.id===colId);if(!col)return;
  const titleEl=document.querySelector(`.kb-col[data-col="${colId}"] .kb-col-title`);
  if(!titleEl)return;
  titleEl.outerHTML=`<input type="text" class="kb-col-title-input" value="${col.label}" style="flex:1;background:var(--bg3);border:1px solid var(--green);border-radius:6px;padding:3px 7px;color:var(--text);font-size:12.5px;font-weight:700;font-family:inherit;outline:none" onblur="saveColumnRename('${colId}',this.value)" onkeydown="if(event.key==='Enter')this.blur()">`;
  setTimeout(()=>document.querySelector('.kb-col-title-input')?.focus(),30);
}
async function saveColumnRename(colId,newLabel){
  newLabel=newLabel.trim();
  const col=KANBAN_COLUMNS.find(c=>c.id===colId);if(!col)return;
  if(!newLabel||newLabel===col.label){renderKanbanBoardOnly();return;}
  col.label=newLabel;
  renderKanbanBoardOnly();
  const{error}=await db.from('kanban_columns').update({label:newLabel}).eq('id',colId);
  if(error)showToast('Erro ao renomear lista',true);
}
function deleteColumnFlow(colId){
  const col=KANBAN_COLUMNS.find(c=>c.id===colId);if(!col)return;
  const cardsInCol=KANBAN_CARDS.filter(c=>c.column_id===colId);
  if(cardsInCol.length===0){
    confirm2('Excluir lista?',`A lista "${col.label}" serÃ¡ removida.`,async()=>{
      const{error}=await db.from('kanban_columns').delete().eq('id',colId);
      if(error){showToast('Erro ao excluir lista',true);return;}
      KANBAN_COLUMNS=KANBAN_COLUMNS.filter(c=>c.id!==colId);
      renderKanbanBoardOnly();showToast('Lista excluÃ­da');
    });
    return;
  }
  // tem cards: pede pra escolher destino antes de excluir
  const others=KANBAN_COLUMNS.filter(c=>c.id!==colId);
  if(others.length===0){showToast('Crie outra lista antes de excluir esta',true);return;}
  const destId=prompt(`A lista "${col.label}" tem ${cardsInCol.length} demanda(s). Para qual lista mover antes de excluir?\n\n`+others.map((c,i)=>`${i+1}) ${c.label}`).join('\n'));
  const idx=parseInt(destId,10)-1;
  if(isNaN(idx)||!others[idx])return;
  confirm2('Excluir lista?',`As demandas serÃ£o movidas para "${others[idx].label}" e a lista "${col.label}" serÃ¡ removida.`,async()=>{
    for(const c of cardsInCol){await moveKbCard(c.id,others[idx].id);}
    const{error}=await db.from('kanban_columns').delete().eq('id',colId);
    if(error){showToast('Erro ao excluir lista',true);return;}
    KANBAN_COLUMNS=KANBAN_COLUMNS.filter(c=>c.id!==colId);
    renderKanbanBoardOnly();showToast('Lista excluÃ­da e demandas movidas');
  });
}
function renderKbColumn(col){
  const cards=kanbanFilteredCards(col.id);
  return`
    <div class="kb-col" data-col="${col.id}">
      <div class="kb-col-head" draggable="true" data-col-drag="${col.id}">
        <span class="kb-col-dot" style="background:${col.color}"></span>
        <span class="kb-col-title" ondblclick="startRenameColumn('${col.id}')" title="Clique duas vezes para renomear">${col.label}</span>
        <span class="kb-col-count">${cards.length}</span>
        <button class="icon-btn" style="width:22px;height:22px;font-size:11px" onclick="deleteColumnFlow('${col.id}')" title="Excluir lista">ðŸ—‘</button>
      </div>
      <div class="kb-col-body" data-col-body="${col.id}">
        ${cards.length===0?'<div class="kb-col-empty">Nenhuma demanda aqui</div>':cards.map(c=>renderKbCard(c)).join('')}
      </div>
      <div class="kb-col-add" onclick="openNewKbCardModal('${col.id}')">+ Adicionar</div>
    </div>`;
}
function renderKbCard(c){
  const client=CLIENTS.find(x=>x.id===c.client_id);
  const collab=COLLABS.find(x=>x.id===c.collaborator_id);
  const atts=c.attachments||[];
  const coverImg=atts.find(f=>f.ft==='image');
  const attCount=atts.length;
  const commentCount=(KB_COMMENTS_CACHE[c.id]||[]).length;
  return`
    <div class="kb-card" draggable="true" data-card-id="${c.id}" onclick="openKbCardDetail('${c.id}')">
      ${coverImg?`<img class="kb-card-cover" src="${coverImg.url}" alt="">`:''}
      <div style="padding:${coverImg?'10px 11px 11px':'0 0 2px'}">
        <div class="kb-card-client">
          <span class="dot" style="background:${client?.color||'#888'}"></span>
          <span>${client?.name||'â€”'}</span>
          ${c.source_briefing_id?'<span class="kb-card-from-pedido">Pedido</span>':''}
        </div>
        <div class="kb-card-title">${c.title}</div>
        ${c.description?`<div class="kb-card-desc">${c.description}</div>`:''}
        <div class="kb-card-foot">
          ${collab?`<div class="kb-card-collab"><div class="av">${collab.name.charAt(0)}</div></div>`:'<span></span>'}
          <div style="display:flex;gap:7px;align-items:center">
            ${attCount>0?`<span class="kb-card-meta">ðŸ“Ž ${attCount}</span>`:''}
            ${commentCount>0?`<span class="kb-card-meta">ðŸ’¬ ${commentCount}</span>`:''}
          </div>
        </div>
      </div>
    </div>`;
}

// drag and drop: cards entre colunas + colunas entre si (reordenar)
function setupKanbanDnD(){
  setTimeout(()=>{
    // â”€â”€ CARD DRAG â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    document.querySelectorAll('.kb-card').forEach(card=>{
      card.setAttribute('draggable','true');

      card.addEventListener('dragstart',e=>{
        e.stopPropagation();
        kanbanDraggedType='card';
        kanbanDraggedId=card.dataset.cardId;
        setTimeout(()=>card.classList.add('dragging'),0);
        e.dataTransfer.effectAllowed='move';
      });
      card.addEventListener('dragend',()=>{
        card.classList.remove('dragging');
        clearDragIndicators();
      });

      // intra-column: hover over a card â†’ show insertion line
      card.addEventListener('dragover',e=>{
        if(kanbanDraggedType!=='card'||kanbanDraggedId===card.dataset.cardId)return;
        e.preventDefault();e.stopPropagation();
        clearDragIndicators();
        const rect=card.getBoundingClientRect();
        const isAbove=e.clientY<rect.top+rect.height/2;
        card.classList.add(isAbove?'drag-above':'drag-below');
      });
      card.addEventListener('dragleave',()=>clearDragIndicators());
      card.addEventListener('drop',async e=>{
        e.preventDefault();e.stopPropagation();
        if(kanbanDraggedType!=='card'||!kanbanDraggedId)return;
        const targetId=card.dataset.cardId;
        if(kanbanDraggedId===targetId){clearDragIndicators();return;}
        const rect=card.getBoundingClientRect();
        const insertBefore=e.clientY<rect.top+rect.height/2;
        clearDragIndicators();
        await reorderCardInColumn(kanbanDraggedId,targetId,insertBefore);
        kanbanDraggedId=null;kanbanDraggedType=null;
      });
    });

    // â”€â”€ COLUMN HEAD DRAG (reorder columns) â”€â”€â”€â”€â”€â”€â”€â”€
    document.querySelectorAll('[data-col-drag]').forEach(head=>{
      head.addEventListener('dragstart',e=>{
        kanbanDraggedType='column';
        kanbanDraggedColId=head.dataset.colDrag;
        e.dataTransfer.effectAllowed='move';
      });
    });

    // â”€â”€ COLUMN DROP ZONE (move card between cols) â”€
    document.querySelectorAll('.kb-col').forEach(col=>{
      col.addEventListener('dragover',e=>{
        if(kanbanDraggedType==='card'){e.preventDefault();col.classList.add('drag-over');}
        else if(kanbanDraggedType==='column'){e.preventDefault();col.classList.add('drag-over');}
      });
      col.addEventListener('dragleave',e=>{
        // only remove if leaving the col itself (not entering a child)
        if(!col.contains(e.relatedTarget))col.classList.remove('drag-over');
      });
      col.addEventListener('drop',async e=>{
        e.preventDefault();col.classList.remove('drag-over');
        clearDragIndicators();
        const targetColId=col.dataset.col;if(!targetColId)return;
        if(kanbanDraggedType==='card'&&kanbanDraggedId){
          const card=KANBAN_CARDS.find(c=>c.id===kanbanDraggedId);
          if(card&&card.column_id!==targetColId){
            await moveKbCard(kanbanDraggedId,targetColId);
          }
          kanbanDraggedId=null;
        }else if(kanbanDraggedType==='column'&&kanbanDraggedColId&&kanbanDraggedColId!==targetColId){
          await reorderColumns(kanbanDraggedColId,targetColId);
          kanbanDraggedColId=null;
        }
        kanbanDraggedType=null;
      });
    });
  },80);
}

function clearDragIndicators(){
  document.querySelectorAll('.drag-above,.drag-below').forEach(el=>{
    el.classList.remove('drag-above','drag-below');
  });
}

async function reorderCardInColumn(draggedId,targetId,insertBefore){
  const dragged=KANBAN_CARDS.find(c=>c.id===draggedId);
  const target=KANBAN_CARDS.find(c=>c.id===targetId);
  if(!dragged||!target)return;

  // If moving between columns, just do a normal move first
  if(dragged.column_id!==target.column_id){
    await moveKbCard(draggedId,target.column_id);
    // After moving, re-apply position relative to target
    dragged.column_id=target.column_id;
  }

  // Get all cards in the column sorted by position
  const colCards=KANBAN_CARDS
    .filter(c=>c.column_id===target.column_id)
    .sort((a,b)=>(a.position??0)-(b.position??0));

  // Remove dragged from array, insert at new position
  const withoutDragged=colCards.filter(c=>c.id!==draggedId);
  const targetIdx=withoutDragged.findIndex(c=>c.id===targetId);
  const insertIdx=insertBefore?targetIdx:targetIdx+1;
  withoutDragged.splice(insertIdx,0,dragged);

  // Assign new positions and update optimistically
  withoutDragged.forEach((c,i)=>{c.position=i;});
  renderKanbanBoardOnly();

  // Persist to DB
  const updates=withoutDragged.map(c=>
    db.from('kanban_cards').update({position:c.position}).eq('id',c.id)
  );
  await Promise.all(updates);
}

async function reorderColumns(draggedId,targetId){
  const fromIdx=KANBAN_COLUMNS.findIndex(c=>c.id===draggedId);
  const toIdx=KANBAN_COLUMNS.findIndex(c=>c.id===targetId);
  if(fromIdx<0||toIdx<0)return;
  const[moved]=KANBAN_COLUMNS.splice(fromIdx,1);
  KANBAN_COLUMNS.splice(toIdx,0,moved);
  KANBAN_COLUMNS.forEach((c,i)=>{c.position=i;});
  renderKanbanBoardOnly();
  for(const c of KANBAN_COLUMNS){await db.from('kanban_columns').update({position:c.position}).eq('id',c.id);}
}
async function moveKbCard(cardId,newColumnId){
  const card=KANBAN_CARDS.find(c=>c.id===cardId);
  if(!card||card.column_id===newColumnId)return;
  const maxPos=KANBAN_CARDS.filter(c=>c.column_id===newColumnId).reduce((m,c)=>Math.max(m,(c.position??0)),-1);
  const oldCol=KANBAN_COLUMNS.find(c=>c.id===card.column_id);
  const newCol=KANBAN_COLUMNS.find(c=>c.id===newColumnId);
  card.column_id=newColumnId;
  card.position=maxPos+1;
  renderKanbanBoardOnly();
  const{error}=await db.from('kanban_cards').update({column_id:newColumnId,position:card.position}).eq('id',cardId);
  if(error){showToast('Erro ao mover card',true);return;}
  // notify assigned collaborator / other users
  if(card.collaborator_id){
    const collab=COLLABS.find(c=>c.id===card.collaborator_id);
    const collabUser=USER_ROLES.find(r=>r.email.split('@')[0].toLowerCase()===collab?.name?.toLowerCase());
    if(collabUser){createNotification(collabUser.email,'card_moved',`Card movido: ${card.title}`,`De "${oldCol?.label}" â†’ "${newCol?.label}"`,cardId);}
  }
}

// NEW CARD
function openNewKbCardModal(presetColumn){
  kbNewFiles=[];
  document.getElementById('kb-new-client').innerHTML=CLIENTS.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  document.getElementById('kb-new-title').value='';
  document.getElementById('kb-new-desc').value='';
  document.getElementById('kb-new-collab').innerHTML='<option value="">â€” Sem atribuiÃ§Ã£o â€”</option>'+COLLABS.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  document.getElementById('kb-new-column').innerHTML=KANBAN_COLUMNS.map(c=>`<option value="${c.id}" ${presetColumn===c.id?'selected':''}>${c.label}</option>`).join('');
  document.getElementById('kb-new-preview').innerHTML='';
  document.getElementById('kb-new-files').innerHTML='';
  openOv('ov-new-kbcard');
  setTimeout(()=>document.getElementById('kb-new-title').focus(),200);
}
function kbNewDrop(e){e.preventDefault();document.getElementById('kb-new-dropzone').classList.remove('drag');kbNewHandleFiles(e.dataTransfer.files);}
function kbNewFileSelect(inp){kbNewHandleFiles(inp.files);inp.value='';}
function kbNewHandleFiles(files){
  Array.from(files).slice(0,20).forEach(f=>{
    kbNewFiles.push({file:f,url:URL.createObjectURL(f),name:f.name,ft:getFileType(f)});
  });
  document.getElementById('kb-new-preview').innerHTML=kbNewFiles.map(f=>f.ft==='image'?`<img class="p-thumb" src="${f.url}">`:`<div class="p-thumb-v">${FILE_TYPE_ICONS[f.ft]||'ðŸ“Ž'}</div>`).join('');
  document.getElementById('kb-new-files').innerHTML=kbNewFiles.map((f,i)=>`<div class="dz-file"><span>${FILE_TYPE_ICONS[f.ft]||'ðŸ“Ž'}</span><span class="fn">${f.name}</span><span class="rm" onclick="kbNewRemoveFile(${i})">Ã—</span></div>`).join('');
}
function kbNewRemoveFile(i){kbNewFiles.splice(i,1);kbNewHandleFiles([]);}
async function submitNewKbCard(){
  const clientId=document.getElementById('kb-new-client').value;
  const title=document.getElementById('kb-new-title').value.trim();
  if(!clientId){showToast('Cadastre um cliente primeiro',true);return;}
  if(!title){showToast('Informe o tÃ­tulo da demanda',true);return;}
  const btn=document.getElementById('btn-create-kbcard');
  btn.innerHTML='<span class="spinner spinner-dark"></span> Criandoâ€¦';btn.disabled=true;
  const colId=document.getElementById('kb-new-column').value;
  const newPos=KANBAN_CARDS.filter(c=>c.column_id===colId).reduce((m,c)=>Math.max(m,(c.position??0)),-1)+1;
  const{data,error}=await db.from('kanban_cards').insert({
    client_id:clientId,title,
    description:document.getElementById('kb-new-desc').value.trim(),
    collaborator_id:document.getElementById('kb-new-collab').value||null,
    column_id:colId,
    position:newPos,
    attachments:[]
  }).select().single();
  btn.innerHTML='Criar demanda';btn.disabled=false;
  if(error){showToast('Erro ao criar demanda',true);return;}
  // upload inline files if any
  if(kbNewFiles.length>0){
    const newAtt=[];
    for(const f of kbNewFiles){
      const path=`kanban/${clientId}/${data.id}/${Date.now()}_${safeFileName(f.name)}`;
      const{error:upErr}=await db.storage.from(BUCKET).upload(path,f.file,{upsert:true});
      if(upErr)continue;
      const{data:ud}=db.storage.from(BUCKET).getPublicUrl(path);
      newAtt.push({name:f.name,url:ud.publicUrl,ft:f.ft});
    }
    if(newAtt.length>0){
      await db.from('kanban_cards').update({attachments:newAtt}).eq('id',data.id);
      data.attachments=newAtt;
    }
    kbNewFiles=[];
  }
  KANBAN_CARDS.push(data);
  closeOv('ov-new-kbcard');
  renderKanbanBoardOnly();
  showToast('Demanda criada!');
}

// CARD DETAIL
async function openKbCardDetail(id){
  const c=KANBAN_CARDS.find(x=>x.id===id);if(!c)return;
  kbDetailFiles=[];
  const client=CLIENTS.find(x=>x.id===c.client_id);
  document.getElementById('kbd-title').textContent=c.title;
  // Load comments
  await loadCardComments(id);
  const comments=KB_COMMENTS_CACHE[id]||[];
  const isAdmin=curUserRole==='admin';
  document.getElementById('kbd-body').innerHTML=`
    <div class="fg2"><label>Cliente</label>
      <select id="kbd-client" onchange="updateKbField('${id}','client_id',this.value)">
        ${CLIENTS.map(cl=>`<option value="${cl.id}" ${cl.id===c.client_id?'selected':''}>${cl.name}</option>`).join('')}
      </select>
    </div>
    <div class="fg2"><label>TÃ­tulo</label><input type="text" id="kbd-titlein" value="${c.title.replace(/"/g,'&quot;')}" onblur="updateKbField('${id}','title',this.value)"></div>
    <div class="fg2"><label>DescriÃ§Ã£o</label><textarea id="kbd-descin" rows="3" style="min-height:80px;resize:none;overflow:hidden" oninput="autoGrow(this)" onblur="updateKbField('${id}','description',this.value)">${c.description||''}</textarea></div>
    <div class="fg2"><label>Colaborador</label>
      <select id="kbd-collab" onchange="updateKbField('${id}','collaborator_id',this.value||null)">
        <option value="">â€” Sem atribuiÃ§Ã£o â€”</option>
        ${COLLABS.map(cl=>`<option value="${cl.id}" ${cl.id===c.collaborator_id?'selected':''}>${cl.name}</option>`).join('')}
      </select>
    </div>
    <div class="fg2"><label>Mover para coluna</label>
      <div class="kb-move-row">
        ${KANBAN_COLUMNS.map(col=>`<button class="f-chip ${col.id===c.column_id?'active':''}" onclick="moveKbCardFromDetail('${id}','${col.id}')">${col.label}</button>`).join('')}
      </div>
    </div>
    <div class="fg2"><label>Anexos</label>
      <div class="dz" onclick="document.getElementById('kbd-file-input').click()" ondragover="event.preventDefault();this.classList.add('drag')" ondragleave="this.classList.remove('drag')" ondrop="kbDetailDrop(event,'${id}')">
        <div class="dz-ico">â˜</div><p>Arraste arquivos ou clique</p><span>Imagens, vÃ­deos ou documentos</span>
      </div>
      <input type="file" id="kbd-file-input" multiple accept="*/*" style="display:none" onchange="kbDetailFileSelect(this,'${id}')">
      <div class="kb-attach-grid" id="kbd-attach-grid">${renderKbAttachments(c)}</div>
    </div>
    <div class="kb-comments">
      <div class="kb-comments-title">ComentÃ¡rios</div>
      <div id="kbd-comments-list">
        ${comments.length===0?'<div class="kb-comment-empty">Nenhum comentÃ¡rio ainda</div>':comments.map(cm=>renderComment(cm)).join('')}
      </div>
      <div class="kb-comment-input-row">
        <div class="kb-comment .av" style="width:26px;height:26px;border-radius:50%;background:#818cf8;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;flex-shrink:0;align-self:flex-end;margin-bottom:2px">${(curUser?.email||'?').charAt(0).toUpperCase()}</div>
        <textarea id="new-comment-input" placeholder="Escreva um comentÃ¡rio... (Enter para enviar, Shift+Enter para nova linha)" rows="2" style="min-height:52px;resize:none;overflow:hidden" oninput="autoGrow(this)" onkeydown="handleCommentKey(event,'${id}')"></textarea>
        <button class="btn btn-green btn-sm" onclick="submitComment('${id}')">Enviar</button>
      </div>
    </div>
    ${isAdmin?`
    <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border)">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--text3);font-weight:600;margin-bottom:10px">FinalizaÃ§Ã£o</div>
      <div id="kbd-finalize-area">
        ${c.finalized_material_id
          ?`<div style="background:var(--green-dim);border:1px solid rgba(107,175,69,.3);border-radius:10px;padding:12px 14px;display:flex;align-items:center;gap:10px">
              <span style="font-size:20px">âœ…</span>
              <div style="flex:1">
                <div style="font-size:13px;font-weight:600;color:var(--green)">Enviado para Materiais</div>
                <div style="font-size:11px;color:var(--text3)">Esta demanda jÃ¡ foi finalizada</div>
              </div>
              <button class="btn btn-ghost btn-sm" onclick="undoKbFinalize('${id}')">Desfazer</button>
            </div>`
          :`<button class="btn btn-ghost btn-sm" style="width:100%;justify-content:center;color:var(--text3)" onclick="openKbFinalizeFlow('${id}')">
              ðŸ“¤ Finalizar e enviar para Materiais
            </button>
            <div style="font-size:11px;color:var(--text3);text-align:center;margin-top:5px">Sobe as artes finais e envia direto para o relatÃ³rio do cliente</div>`}
      </div>
    </div>
    <button class="btn btn-red btn-sm" style="margin-top:10px" onclick="deleteKbCard('${id}')">ðŸ—‘ Excluir demanda</button>`:''}
  `;
  openOv('ov-kbcard-detail');
  applyAutoGrow();
  setTimeout(()=>setupCardMentionListener(id),150);
}

function renderComment(cm){
  const initial=(cm.user_email||'?').charAt(0).toUpperCase();
  const time=new Date(cm.created_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
  return`<div class="kb-comment">
    <div class="av">${initial}</div>
    <div class="kb-comment-body">
      <div class="kb-comment-header">
        <span class="kb-comment-author">${cm.user_email?.split('@')[0]||'UsuÃ¡rio'}</span>
        <span class="kb-comment-time">${time}</span>
      </div>
      <div class="kb-comment-text">${cm.content.replace(/\n/g,'<br>')}</div>
    </div>
  </div>`;
}
async function loadCardComments(cardId){
  const{data,error}=await db.from('kanban_comments').select('*').eq('card_id',cardId).order('created_at',{ascending:true});
  KB_COMMENTS_CACHE[cardId]=error?[]:(data||[]);
}
async function submitComment(cardId){
  const input=document.getElementById('new-comment-input');
  const content=input.value.trim();
  if(!content)return;
  input.value='';autoGrow(input);
  const{data,error}=await db.from('kanban_comments').insert({
    card_id:cardId,user_email:curUser?.email||'â€”',content
  }).select().single();
  if(error){showToast('Erro ao enviar comentÃ¡rio',true);return;}
  if(!KB_COMMENTS_CACHE[cardId])KB_COMMENTS_CACHE[cardId]=[];
  KB_COMMENTS_CACHE[cardId].push(data);
  const list=document.getElementById('kbd-comments-list');
  if(list){
    if(list.querySelector('.kb-comment-empty'))list.innerHTML='';
    list.insertAdjacentHTML('beforeend',renderComment(data));
    list.scrollTop=list.scrollHeight;
  }
  // notify mentioned users
  const mentions=parseMentions(content);
  const card=KANBAN_CARDS.find(c=>c.id===cardId);
  for(const email of mentions){
    createNotification(email,'mention',`@${curUser?.email?.split('@')[0]} mencionou vocÃª`,`Em "${card?.title}": ${content.slice(0,80)}`,cardId);
  }
}
function handleCommentKey(e,cardId){
  if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();submitComment(cardId);}
}
// setup mention listener after card detail opens
function setupCardMentionListener(cardId){
  const ta=document.getElementById('new-comment-input');
  if(ta)setupMentionListener(ta,cardId);
}
function renderKbAttachments(c){
  const atts=c.attachments||[];
  if(atts.length===0)return'';
  return atts.map((f,i)=>{
    const ft=f.ft||'file';
    let thumb='';
    if(ft==='image') thumb=`<img src="${f.url}" loading="lazy">`;
    else if(ft==='video') thumb=`<video src="${f.url}" muted preload="metadata"></video>`;
    else thumb=`<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;background:var(--bg3)"><span style="font-size:26px">${FILE_TYPE_ICONS[ft]||'ðŸ“Ž'}</span><span style="font-size:9px;color:var(--text3);text-align:center;padding:0 4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:90%">${f.name.split('.').pop().toUpperCase()}</span></div>`;
    return`<div class="kb-attach-item" onclick="openAttViewer('${c.id}',${i})">
      ${thumb}
      <span class="kb-attach-name">${f.name}</span>
      <button class="kb-attach-rm" onclick="event.stopPropagation();removeKbAttachment('${c.id}',${i})" title="Remover">Ã—</button>
    </div>`;
  }).join('');
}
async function updateKbField(id,field,value){
  const c=KANBAN_CARDS.find(x=>x.id===id);if(!c)return;
  c[field]=value;
  const{error}=await db.from('kanban_cards').update({[field]:value}).eq('id',id);
  if(error){showToast('Erro ao salvar',true);return;}
  renderKanbanBoardOnly();
  if(field==='title')document.getElementById('kbd-title').textContent=value;
}
async function moveKbCardFromDetail(id,colId){
  await moveKbCard(id,colId);
  openKbCardDetail(id);
}
function kbDetailDrop(e,id){e.preventDefault();e.currentTarget.classList.remove('drag');kbHandleDetailFiles(e.dataTransfer.files,id);}
function kbDetailFileSelect(inp,id){kbHandleDetailFiles(inp.files,id);inp.value='';}
async function kbHandleDetailFiles(files,id){
  const c=KANBAN_CARDS.find(x=>x.id===id);if(!c)return;
  showToast('Enviando anexosâ€¦');
  const newAtt=[...(c.attachments||[])];
  for(const f of Array.from(files).slice(0,20)){
    const ft=getFileType(f);
    const path=`kanban/${c.client_id}/${id}/${Date.now()}_${safeFileName(f.name)}`;
    const{error}=await db.storage.from(BUCKET).upload(path,f,{upsert:true});
    if(error)continue;
    const{data:ud}=db.storage.from(BUCKET).getPublicUrl(path);
    newAtt.push({name:f.name,url:ud.publicUrl,ft});
  }
  c.attachments=newAtt;
  await db.from('kanban_cards').update({attachments:newAtt}).eq('id',id);
  document.getElementById('kbd-attach-grid').innerHTML=renderKbAttachments(c);
  renderKanbanBoardOnly();
  showToast('Anexos enviados!');
}
async function removeKbAttachment(id,idx){
  const c=KANBAN_CARDS.find(x=>x.id===id);if(!c)return;
  c.attachments=(c.attachments||[]).filter((_,i)=>i!==idx);
  await db.from('kanban_cards').update({attachments:c.attachments}).eq('id',id);
  document.getElementById('kbd-attach-grid').innerHTML=renderKbAttachments(c);
  renderKanbanBoardOnly();
}
function deleteKbCard(id){
  confirm2('Excluir demanda?','Esta aÃ§Ã£o nÃ£o pode ser desfeita.',async()=>{
    const{error}=await db.from('kanban_cards').delete().eq('id',id);
    if(error){showToast('Erro ao excluir',true);return;}
    KANBAN_CARDS=KANBAN_CARDS.filter(c=>c.id!==id);
    closeOv('ov-kbcard-detail');
    renderKanbanBoardOnly();
    showToast('Demanda excluÃ­da');
  });
}

// FINALIZE FROM KANBAN â†’ cria material no cliente
function openKbFinalizeFlow(id){
  kbFinalizeFiles=[];
  const c=KANBAN_CARDS.find(x=>x.id===id);if(!c)return;
  const linkedBriefing=c.source_briefing_id?BRIEFINGS.find(b=>b.id===c.source_briefing_id):null;
  const defaultType=linkedBriefing?(PF_TYPE_TO_MAT[linkedBriefing.material_type]||'post'):'post';
  const area=document.getElementById('kbd-finalize-area');
  area.innerHTML=`
    <div class="fg2"><label>Tipo de material</label>
      <select id="kbf-type">${TYPES.map(t=>`<option value="${t.id}" ${t.id===defaultType?'selected':''}>${t.emoji} ${t.label}</option>`).join('')}</select>
    </div>
    <div class="dz" onclick="document.getElementById('kbf-file-input').click()" ondragover="event.preventDefault();this.classList.add('drag')" ondragleave="this.classList.remove('drag')" ondrop="kbFinalizeDrop(event)">
      <div class="dz-ico">â˜</div><p>Arraste as artes finais</p><span>Imagens ou vÃ­deos Â· usa anexos do card automaticamente se nÃ£o enviar novos</span>
    </div>
    <input type="file" id="kbf-file-input" multiple accept="*/*" style="display:none" onchange="kbFinalizeFileSelect(this)">
    <div class="preview-strip" id="kbf-preview"></div>
    <div class="u-actions">
      <button class="btn btn-ghost" onclick="openKbCardDetail('${id}')">Cancelar</button>
      <button class="btn btn-green" id="btn-kbf-submit" onclick="submitKbFinalize('${id}')">Confirmar finalizaÃ§Ã£o</button>
    </div>`;
}
function kbFinalizeDrop(e){e.preventDefault();e.currentTarget.classList.remove('drag');kbFinalizeHandleFiles(e.dataTransfer.files);}
function kbFinalizeFileSelect(inp){kbFinalizeHandleFiles(inp.files);inp.value='';}
function kbFinalizeHandleFiles(files){
  Array.from(files).slice(0,30).forEach(f=>{kbFinalizeFiles.push({file:f,url:URL.createObjectURL(f),name:f.name,ft:getFileType(f)});});
  document.getElementById('kbf-preview').innerHTML=kbFinalizeFiles.map(f=>f.ft==='image'?`<img class="p-thumb" src="${f.url}">`:`<div class="p-thumb-v">${FILE_TYPE_ICONS[f.ft]||'ðŸ“Ž'}</div>`).join('');
}
async function submitKbFinalize(id){
  const c=KANBAN_CARDS.find(x=>x.id===id);if(!c)return;
  const btn=document.getElementById('btn-kbf-submit');
  btn.innerHTML='<span class="spinner spinner-dark"></span> Finalizandoâ€¦';btn.disabled=true;
  try{
    const matType=document.getElementById('kbf-type').value;
    const today=new Date().toISOString().split('T')[0];
    const{data:mat,error:matErr}=await db.from('materials').insert({
      client_id:c.client_id,type:matType,date:today,description:c.title,collaborator_id:c.collaborator_id||null
    }).select().single();
    if(matErr)throw matErr;
    const fileRows=[];
    // novos arquivos enviados agora
    for(const f of kbFinalizeFiles){
      const path=`${c.client_id}/${mat.id}/${Date.now()}_${safeFileName(f.name)}`;
      const{error:upErr}=await db.storage.from(BUCKET).upload(path,f.file,{upsert:true});
      if(upErr)throw upErr;
      const{data:ud}=db.storage.from(BUCKET).getPublicUrl(path);
      fileRows.push({material_id:mat.id,name:f.name,url:ud.publicUrl,file_type:f.ft});
    }
    // se nÃ£o enviou nada novo, reaproveita os anexos jÃ¡ no card
    if(fileRows.length===0&&(c.attachments||[]).length>0){
      c.attachments.forEach(a=>fileRows.push({material_id:mat.id,name:a.name,url:a.url,file_type:a.ft}));
    }
    if(fileRows.length>0){const{error:fErr}=await db.from('files').insert(fileRows);if(fErr)throw fErr;}
    mat.files=fileRows;
    if(!MATS_CACHE[c.client_id])MATS_CACHE[c.client_id]=[];
    MATS_CACHE[c.client_id].unshift(mat);
    ALL_MATS_LIGHT.push({id:mat.id,client_id:c.client_id,type:matType});
    renderSidebar();
    // salva referÃªncia para evitar duplicaÃ§Ã£o
    c.finalized_material_id=mat.id;
    await db.from('kanban_cards').update({finalized_material_id:mat.id}).eq('id',id);
    // sincroniza pedido de origem, se houver
    if(c.source_briefing_id){
      await db.from('briefings').update({status:'Concluido'}).eq('id',c.source_briefing_id);
      const b=BRIEFINGS.find(x=>x.id===c.source_briefing_id);if(b)b.status='Concluido';
      updatePedidosBadge();
    }
    const finalCol=KANBAN_COLUMNS.find(col=>col.label.toLowerCase()==='finalizado');
    if(finalCol)await moveKbCard(id,finalCol.id);
    kbFinalizeFiles=[];
    closeOv('ov-kbcard-detail');
    if(curClient&&curClient.id===c.client_id)switchClientTab(clientTab);
    showToast('âœ… Demanda finalizada e enviada para Materiais!');
  }catch(e){
    console.error(e);showToast('E
