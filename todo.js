// ═══ TODO — To-Do Semanal, Tarefas Recorrentes ═══
// TODO SEMANAL
// ═══════════════════════════════════════════════════
const TODO_DAYS=['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
function getMondayOfWeek(date){
  const d=new Date(date);
  const day=d.getDay();
  const diff=day===0?-6:1-day;
  d.setDate(d.getDate()+diff);
  d.setHours(0,0,0,0);
  return d;
}
function weekDateStr(d){return d.toISOString().split('T')[0];}
function addDays(d,n){const r=new Date(d);r.setDate(r.getDate()+n);return r;}
async function loadTodoItems(){
  const wStr=weekDateStr(todoWeekDate);
  const prevWStr=weekDateStr(addDays(todoWeekDate,-7));

  // 1. Busca apenas as tarefas da semana atual
  const{data:currData}=await db.from('todo_items').select('*')
    .eq('week_date',wStr).order('position',{ascending:true});
  TODO_ITEMS=currData||[];

  // 2. Busca tarefas recorrentes da semana anterior (para propagar)
  const{data:prevData}=await db.from('todo_items').select('*')
    .eq('week_date',prevWStr).eq('is_recurring',true);
  const prevRecurring=prevData||[];

  // 3. Propaga apenas as recorrentes que NÃO existem ainda na semana atual
  //    (se já foram deletadas da semana atual, não recria)
  await propagateRecurring(prevRecurring,wStr);
}

async function propagateRecurring(templates,wStr){
  if(!templates.length)return;
  const existing=TODO_ITEMS;
  const toCreate=[];
  for(const t of templates){
    const alreadyExists=existing.find(e=>
      e.is_recurring&&
      e.title===t.title&&
      e.day_of_week===t.day_of_week
    );
    if(!alreadyExists){
      toCreate.push({
        title:t.title,day_of_week:t.day_of_week,
        client_id:t.client_id,assigned_email:t.assigned_email,
        task_time:t.task_time,is_recurring:true,
        week_date:wStr,completed:false,position:t.position
      });
    }
  }
  if(!toCreate.length)return;
  const{data,error}=await db.from('todo_items').insert(toCreate).select();
  if(!error&&data)TODO_ITEMS.push(...data);
}
function renderTodoScreen(){
  const wStr=weekDateStr(todoWeekDate);
  const prevW=weekDateStr(addDays(todoWeekDate,-7));
  const nextW=weekDateStr(addDays(todoWeekDate,7));
  const todayStr=weekDateStr(new Date());
  const mon=new Date(todoWeekDate);
  const sun=addDays(mon,6);
  const fmtD=(d)=>d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
  return`
    <div class="todo-tabs">
      <button class="todo-tab ${todoTab==='board'?'active':''}" onclick="setTodoTab('board')">📋 Semana</button>
      <button class="todo-tab ${todoTab==='done'?'active':''}" onclick="setTodoTab('done')">✅ Concluídos</button>
    </div>
    <div class="todo-toolbar">
      <div class="todo-week-nav">
        <button class="todo-nav-btn" onclick="navTodoWeek(-1)">‹</button>
        <span class="todo-week-label">${fmtD(mon)} – ${fmtD(sun)}</span>
        <button class="todo-nav-btn" onclick="navTodoWeek(1)">›</button>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="navTodoToday()">Hoje</button>
      <button class="btn btn-green btn-sm" onclick="openNewTodo()">+ Nova tarefa</button>
    </div>
    ${todoTab==='board'?renderTodoBoard(wStr,todayStr):renderTodoDone()}`;
}
function renderTodoBoard(wStr,todayStr){
  const today=new Date();
  return`<div class="todo-board">
    ${TODO_DAYS.map((day,i)=>{
      const dayNum=i+1;
      const dayDate=addDays(todoWeekDate,i);
      const dayStr=weekDateStr(dayDate);
      const isToday=dayStr===todayStr;
      const tasks=TODO_ITEMS.filter(t=>t.week_date===wStr&&t.day_of_week===dayNum);
      return`<div class="todo-col">
        <div class="todo-col-head ${isToday?'today':''}">
          <span class="todo-col-day">${day}</span>
          <span class="todo-col-date">${dayDate.getDate()}/${dayDate.getMonth()+1}</span>
        </div>
        <div class="todo-col-body">
          ${tasks.length===0?'<div style="font-size:11px;color:var(--text3);text-align:center;padding:10px 0">Sem tarefas</div>':tasks.map(t=>renderTodoCard(t)).join('')}
        </div>
        <div class="todo-col-add" onclick="openNewTodo(${dayNum})">+ Adicionar</div>
      </div>`;}).join('')}
  </div>`;
}
// Calcula a data/hora real da tarefa a partir da semana + dia + horário
function getTaskDateTime(t){
  // week_date = segunda da semana, day_of_week: 1=seg, 2=ter... 7=dom
  const monday=new Date(t.week_date+'T00:00:00');
  const taskDate=new Date(monday);
  taskDate.setDate(monday.getDate()+(t.day_of_week-1));
  if(t.task_time){
    const parts=t.task_time.split(':');
    taskDate.setHours(parseInt(parts[0]),parseInt(parts[1]),0,0);
  }else{
    taskDate.setHours(23,59,59,0); // sem horário → não expira
  }
  return taskDate;
}
function getTodoTimeState(t){
  if(!t.task_time)return'normal';       // sem horário → sempre normal
  if(t.completed)return'done';
  const now=new Date();
  const taskDT=getTaskDateTime(t);
  const diffMin=(taskDT-now)/60000;    // positivo = falta X min, negativo = já passou
  if(diffMin<0)return'overdue';        // passou do horário → vermelho
  if(diffMin<=120)return'warning';     // até 2h antes → amarelo
  return'normal';                      // mais de 2h → normal
}
function fmtTime(timeStr){
  if(!timeStr)return'';
  const[h,m]=timeStr.split(':');
  return`${h}:${m}`;
}
function wasCompletedLate(t){
  if(!t.task_time||!t.completed_at)return null;
  const taskDT=getTaskDateTime(t);
  const completedAt=new Date(t.completed_at);
  return completedAt>taskDT;
}
function renderTodoCard(t){
  const client=CLIENTS.find(c=>c.id===t.client_id);
  const state=getTodoTimeState(t);
  let colorClass='';
  if(t.completed) colorClass='done';
  else if(state==='overdue') colorClass='overdue';
  else if(state==='warning') colorClass='warning';
  const timeBadgeClass=state==='overdue'?'late':state==='warning'?'warn':'ok';
  return`<div class="todo-card ${colorClass}" onclick="openEditTodo('${t.id}')">
    <div class="todo-check ${t.completed?'checked':''}" onclick="event.stopPropagation();toggleTodo('${t.id}')">
      ${t.completed?'✓':''}
    </div>
    <div class="todo-card-info">
      <div class="todo-card-title">${t.title}</div>
      <div class="todo-card-meta">
        ${client?`<span class="todo-client-dot" style="background:${client.color}"></span><span style="font-size:10px;color:var(--text3)">${client.name}</span>`:''}
        ${t.task_time?`<span class="todo-time-badge ${t.completed?'ok':timeBadgeClass}">🕐 ${fmtTime(t.task_time)}</span>`:''}
        ${t.is_recurring?'<span class="todo-recurring-badge">🔄</span>':''}
        ${t.assigned_email?`<span class="todo-assigned">${t.assigned_email.split('@')[0]}</span>`:''}
      </div>
    </div>
  </div>`;
}
function renderTodoDone(){
  const wStr=weekDateStr(todoWeekDate);
  const done=TODO_ITEMS.filter(t=>t.week_date===wStr&&t.completed);
  if(!done.length)return'<div class="empty"><div class="ico">✅</div><h3>Nenhuma tarefa concluída esta semana</h3><p>Vá arrasar nas tarefas!</p></div>';
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
