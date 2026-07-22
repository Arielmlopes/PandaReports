s read
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
  if(!done.length)return'<div class="empty"><d