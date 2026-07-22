col)return;
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
    confirm2('Excluir lista?',`A lista "${col.label}" será removida.`,async()=>{
      const{error}=await db.from('kanban_columns').delete().eq('id',colId);
      if(error){showToast('Erro ao excluir lista',true);return;}
      KANBAN_COLUMNS=KANBAN_COLUMNS.filter(c=>c.id!==colId);
      renderKanbanBoardOnly();showToast('Lista excluída');
    });
    return;
  }
  // tem cards: pede pra escolher destino antes de excluir
  const others=KANBAN_COLUMNS.filter(c=>c.id!==colId);
  if(others.length===0){showToast('Crie outra lista antes de excluir esta',true);return;}
  const destId=prompt(`A lista "${col.label}" tem ${cardsInCol.length} demanda(s). Para qual lista mover antes de excluir?\n\n`+others.map((c,i)=>`${i+1}) ${c.label}`).join('\n'));
  const idx=parseInt(destId,10)-1;
  if(isNaN(idx)||!others[idx])return;
  confirm2('Excluir lista?',`As demandas serão movidas para "${others[idx].label}" e a lista "${col.label}" será removida.`,async()=>{
    for(const c of cardsInCol){await moveKbCard(c.id,others[idx].id);}
    const{error}=await db.from('kanban_columns').delete().eq('id',colId);
    if(error){showToast('Erro ao excluir lista',true);return;}
    KANBAN_COLUMNS=KANBAN_COLUMNS.filter(c=>c.id!==colId);
    renderKanbanBoardOnly();showToast('Lista excluída e demandas movidas');
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
        <button class="icon-btn" style="width:22px;height:22px;font-size:11px" onclick="deleteColumnFlow('${col.id}')" title="Excluir lista">🗑</button>
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
          <span>${client?.name||'—'}</span>
          ${c.source_briefing_id?'<span class="kb-card-from-pedido">Pedido</span>':''}
        </div>
        <div class="kb-card-title">${c.title}</div>
        ${c.description?`<div class="kb-card-desc">${c.description}</div>`:''}
        <div class="kb-card-foot">
          ${collab?`<div class="kb-card-collab"><div class="av">${collab.name.charAt(0)}</div></div>`:'<span></span>'}
          <div style="display:flex;gap:7px;align-items:center">
            ${attCount>0?`<span class="kb-card-meta">📎 ${attCount}</span>`:''}
            ${commentCount>0?`<span class="kb-card-meta">💬 ${commentCount}</span>`:''}
          </div>
        </div>
      </div>
    </div>`;
}

// drag and drop: cards entre colunas + colunas entre si (reordenar)
function setupKanbanDnD(){
  setTimeout(()=>{
    // ── CARD DRAG ──────────────────────────────────
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

      // intra-column: hover over a card → show insertion line
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

    // ── COLUMN HEAD DRAG (reorder columns) ────────
    document.querySelectorAll('[data-col-drag]').forEach(head=>{
      head.addEventListener('dragstart',e=>{
        kanbanDraggedType='column';
        kanbanDraggedColId=head.dataset.colDrag;
        e.dataTransfer.effectAllowed='move';
      });
    });

    // ── COLUMN DROP ZONE (move card between cols) ─
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
    if(collabUser){createNotification(collabUser.email,'card_moved',`Card movido: ${card.title}`,`De "${oldCol?.label}" → "${newCol?.label}"`,cardId);}
  }
}

// NEW CARD
function openNewKbCardModal(presetColumn){
  kbNewFiles=[];
  document.getElementById('kb-new-client').innerHTML=CLIENTS.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  document.getElementById('kb-new-title').value='';
  document.getElementById('kb-new-desc').value='';
  document.getElementById('kb-new-collab').innerHTML='<option value="">— Sem atribuição —</option>'+COLLABS.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
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
  document.getElementById('kb-new-preview').innerHTML=kbNewFiles.map(f=>f.ft==='image'?`<img class="p-thumb" src="${f.url}">`:`<div class="p-thumb-v">${FILE_TYPE_ICONS[f.ft]||'📎'}</div>`).join('');
  document.getElementById('kb-new-files').innerHTML=kbNewFiles.map((f,i)=>`<div class="dz-file"><span>${FILE_TYPE_ICONS[f.ft]||'📎'}</span><span class="fn">${f.name}</span><span class="rm" onclick="kbNewRemoveFile(${i})">×</span></div>`).join('');
}
function kbNewRemoveFile(i){kbNewFiles.splice(i,1);kbNewHandleFiles([]);}
async function submitNewKbCard(){
  const clientId=document.getElementById('kb-new-client').value;
  const title=document.getElementById('kb-new-title').value.trim();
  if(!clientId){showToast('Cadastre um cliente primeiro',true);return;}
  if(!title){showToast('Informe o título da demanda',true);return;}
  const btn=document.getElementById('btn-create-kbcard');
  btn.innerHTML='<span class="spinner spinner-dark"></span> Criando…';btn.disabled=true;
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
    <div class="fg2"><label>Título</label><input type="text" id="kbd-titlein" value="${c.title.replace(/"/g,'&quot;')}" onblur="updateKbField('${id}','title',this.value)"></div>
    <div class="fg2"><label>Descrição</label><textarea id="kbd-descin" rows="3" style="min-height:80px;resize:none;overflow:hidden" oninput="autoGrow(this)" onblur="updateKbField('${id}','description',this.value)">${c.description||''}</textarea></div>
    <div class="fg2"><label>Colaborador</label>
      <select id="kbd-collab" onchange="updateKbField('${id}','collaborator_id',this.value||null)">
        <option value="">— Sem atribuição —</option>
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
        <div class="dz-ico">☁</div><p>Arraste arquivos ou clique</p><span>Imagens, vídeos ou documentos</span>
      </div>
      <input type="file" id="kbd-file-input" multiple accept="*/*" style="display:none" onchange="kbDetailFileSelect(this,'${id}')">
      <div class="kb-attach-grid" id="kbd-attach-grid">${renderKbAttachments(c)}</div>
    </div>
    <div class="kb-comments">
      <div class="kb-comments-title">Comentários</div>
      <div id="kbd-comments-list">
        ${comments.length===0?'<div class="kb-comment-empty">Nenhum comentário ainda</div>':comments.map(cm=>renderComment(cm)).join('')}
      </div>
      <div class="kb-comment-input-row">
        <div class="kb-comment .av" style="width:26px;height:26px;border-radius:50%;background:#818cf8;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;flex-shrink:0;align-self:flex-end;margin-bottom:2px">${(curUser?.email||'?').charAt(0).toUpperCase()}</div>
        <textarea id="new-comment-input" placeholder="Escreva um comentário... (Enter para enviar, Shift+Enter para nova linha)" rows="2" style="min-height:52px;resize:none;overflow:hidden" oninput="autoGrow(this)" onkeydown="handleCommentKey(event,'${id}')"></textarea>
        <button class="btn btn-green btn-sm" onclick="submitComment('${id}')">Enviar</button>
      </div>
    </div>
    ${isAdmin?`
    <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border)">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--text3);font-weight:600;margin-bottom:10px">Finalização</div>
      <div id="kbd-finalize-area">
        ${c.finalized_material_id
          ?`<div style="background:var(--green-dim);border:1px solid rgba(107,175,69,.3);border-radius:10px;padding:12px 14px;display:flex;align-items:center;gap:10px">
              <span style="font-size:20px">✅</span>
              <div style="flex:1">
                <div style="font-size:13px;font-weight:600;color:var(--green)">Enviado para Materiais</div>
                <div style="font-size:11px;color:var(--text3)">Esta demanda já foi finalizada</div>
              </div>
              <button class="btn btn-ghost btn-sm" onclick="undoKbFinalize('${id}')">Desfazer</button>
            </div>`
          :`<button class="btn btn-ghost btn-sm" style="width:100%;justify-content:center;color:var(--text3)" onclick="openKbFinalizeFlow('${id}')">
              📤 Finalizar e enviar para Materiais
            </button>
            <div style="font-size:11px;color:var(--text3);text-align:center;margin-top:5px">Sobe as artes finais e envia direto para o relatório do cliente</div>`}
      </div>
    </div>
    <button class="btn btn-red btn-sm" style="margin-top:10px" onclick="deleteKbCard('${id}')">🗑 Excluir demanda</button>`:''}
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
        <span class="kb-comment-author">${cm.user_email?.split('@')[0]||'Usuário'}</span>
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
    card_id:cardId,user_email:curUser?.email||'—',content
  }).select().single();
  if(error){showToast('Erro ao enviar comentário',true);return;}
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
    createNotification(email,'mention',`@${curUser?.email?.split('@')[0]} mencionou você`,`Em "${card?.title}": ${content.slice(0,80)}`,cardId);
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
    else thumb=`<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;background:var(--bg3)"><span style="font-size:26px">${FILE_TYPE_ICONS[ft]||'📎'}</span><span style="font-size:9px;color:var(--text3);text-align:center;padding:0 4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:90%">${f.name.split('.').pop().toUpperCase()}</span></div>`;
    return`<div class="kb-attach-item" onclick="openAttViewer('${c.id}',${i})">
      ${thumb}
      <span class="kb-attach-name">${f.name}</span>
      <button class="kb-attach-rm" onclick="event.stopPropagation();removeKbAttachment('${c.id}',${i})" title="Remover">×</button>
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
  showToast('Enviando anexos…');
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
  confirm2('Excluir demanda?','Esta ação não pode ser desfeita.',async()=>{
    const{error}=await db.from('kanban_cards').delete().eq('id',id);
    if(error){showToast('Erro ao excluir',true);return;}
    KANBAN_CARDS=KANBAN_CARDS.filter(c=>c.id!==id);
    closeOv('ov-kbcard-detail');
    renderKanbanBoardOnly();
    showToast('Demanda excluída');
  });
}

// FINALIZE FROM KANBAN → cria material no cliente
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
      <div class="dz-ico">☁</div><p>Arraste as artes finais</p><span>Imagens ou vídeos · usa anexos do card automaticamente se não enviar novos</span>
    </div>
    <input type="file" id="kbf-file-input" multiple accept="*/*" style="display:none" onchange="kbFinalizeFileSelect(this)">
    <div class="preview-strip" id="kbf-preview"></div>
    <div class="u-actions">
      <button class="btn btn-ghost" onclick="openKbCardDetail('${id}')">Cancelar</button>
      <button class="btn btn-green" id="btn-kbf-submit" onclick="submitKbFinalize('${id}')">Confirmar finalização</button>
    </div>`;
}
function kbFinalizeDrop(e){e.preventDefault();e.currentTarget.classList.remove('drag');kbFinalizeHandleFiles(e.dataTransfer.files);}
function kbFinalizeFileSelect(inp){kbFinalizeHandleFiles(inp.files);inp.value='';}
function kbFinalizeHandleFiles(files){
  Array.from(files).slice(0,30).forEach(f=>{kbFinalizeFiles.push({file:f,url:URL.createObjectURL(f),name:f.name,ft:getFileType(f)});});
  document.getElementById('kbf-preview').innerHTML=kbFinalizeFiles.map(f=>f.ft==='image'?`<img class="p-thumb" src="${f.url}">`:`<div class="p-thumb-v">${FILE_TYPE_ICONS[f.ft]||'📎'}</div>`).join('');
}
async function submitKbFinalize(id){
  const c=KANBAN_CARDS.find(x=>x.id===id);if(!c)return;
  const btn=document.getElementById('btn-kbf-submit');
  btn.innerHTML='<span class="spinner spinner-dark"></span> Finalizando…';btn.disabled=true;
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
    // se não enviou nada novo, reaproveita os anexos já no card
    if(fileRows.length===0&&(c.attachments||[]).length>0){
      c.attachments.forEach(a=>fileRows.push({material_id:mat.id,name:a.name,url:a.url,file_type:a.ft}));
    }
    if(fileRows.length>0){const{error:fErr}=await db.from('files').insert(fileRows);if(fErr)throw fErr;}
    mat.files=fileRows;
    if(!MATS_CACHE[c.client_id])MATS_CACHE[c.client_id]=[];
    MATS_CACHE[c.client_id].unshift(mat);
    ALL_MATS_LIGHT.push({id:mat.id,client_id:c.client_id,type:matType});
    renderSidebar();
    // salva referência para evitar duplicação
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
    showToast('✅ Demanda finalizada e enviada para Materiais!');
  }catch(e){
    console.error(e);showToast('Erro ao finalizar: '+(e.message||e),true);
    btn.innerHTML='Confirmar finalização';btn.disabled=false;
  }
}
async function undoKbFinalize(id){
  confirm2('Desfazer finalização?','O material criado no relatório não será removido, mas a demanda poderá ser finalizada novamente.',async()=>{
    const c=KANBAN_CARDS.find(x=>x.id===id);if(!c)return;
    c.finalized_material_id=null;
    await db.from('kanban_cards').update({finalized_material_id:null}).eq('id',id);
    openKbCardDetail(id);
    showToast('Finalização desfeita — você pode finalizar novamente');
  });
}

// ═══════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════
// ═══════════════════════════════════════════════════
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
  // mark a