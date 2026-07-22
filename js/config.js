// ═══════════════════════════════════════════════════
const SUPABASE_URL='https://ovuvykctdwugnzqmzueu.supabase.co';
const SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92dXZ5a2N0ZHd1Z256cW16dWV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyOTM1NzgsImV4cCI6MjA5NDg2OTU3OH0.1EpkvQGCREkk_CVOdp4Et7901o1S3_oXSByE4CV9xsY';
const BUCKET='uploads';
const{createClient}=supabase;
const db=createClient(SUPABASE_URL,SUPABASE_KEY);

// ═══════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════
const PALETTE=['#6BAF45','#3b82f6','#a855f7','#f97316','#ec4899','#eab308','#14b8a6','#ef4444','#64748b','#06b6d4'];
const TYPES=[
  {id:'post',label:'Post',emoji:'🖼',bc:'b-post'},
  {id:'carousel',label:'Carrossel',emoji:'🎠',bc:'b-carousel'},
  {id:'video',label:'Vídeo',emoji:'🎬',bc:'b-video'},
  {id:'story',label:'Story',emoji:'📱',bc:'b-story'},
  {id:'reels',label:'Reels',emoji:'🎞',bc:'b-reels'},
  {id:'identity',label:'ID Visual',emoji:'🎨',bc:'b-identity'},
];
const TE={post:'🖼',carousel:'🎠',video:'🎬',story:'📱',reels:'🎞',identity:'🎨'};
const DAYS=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const MONTHS=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MS=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const DEF={post:'Novo post',carousel:'Novo carrossel',video:'Novo vídeo',story:'Novo story',reels:'Novo reels',identity:'Nova identidade visual'};

// Briefing form constants
const MAT_TYPES_PF=[
  {id:'post',label:'Post único',emoji:'🖼'},
  {id:'carousel',label:'Carrossel',emoji:'🎠'},
  {id:'video',label:'Vídeo / Reels',emoji:'🎬'},
  {id:'story',label:'Story',emoji:'📱'},
  {id:'print',label:'Material impresso',emoji:'🖨'},
  {id:'other',label:'Outro',emoji:'✏️'},
];
const OBJ_OPTIONS=['Informar','Divulgar evento/promoção','Convocar público','Apresentar resultados','Campanha de conscientização','Outro'];
const STATUS_OPTIONS=[
  {id:'Recebido - Aguardando producao',label:'Recebido',cls:'s-recebido'},
  {id:'Em producao',label:'Em produção',cls:'s-producao'},
  {id:'Concluido',label:'Concluído',cls:'s-concluido'},
];

// Kanban
let KANBAN_COLUMNS=[]; // carregado dinamicamente do Supabase (kanban_columns)
const KANBAN_COLUMNS_FALLBACK=[
  {id:'pedidos_clientes',slug:'pedidos_clientes',label:'Pedidos Clientes',color:'#eab308',position:0},
  {id:'demanda_semana',slug:null,label:'Demanda da Semana',color:'#3b82f6',position:1},
  {id:'demanda_dia',slug:null,label:'Demanda do Dia',color:'#06b6d4',position:2},
  {id:'em_producao',slug:null,label:'Em Produção',color:'#a855f7',position:3},
  {id:'alteracao',slug:null,label:'Alteração',color:'#f97316',position:4},
  {id:'aprovacao_agencia',slug:null,label:'Aprovação Agência',color:'#6BAF45',position:5},
  {id:'aprovacao_cliente',slug:null,label:'Aprovação Cliente',color:'#ec4899',position:6},
  {id:'finalizado',slug:null,label:'Finalizado',color:'#22c55e',position:7},
];
const COL_PALETTE=['#6BAF45','#3b82f6','#a855f7','#f97316','#ec4899','#eab308','#14b8a6','#ef4444','#64748b','#06b6d4','#22c55e'];
let kanbanDraggedType=null,kanbanDraggedColId=null;
const PF_TYPE_TO_MAT={post:'post',carousel:'carousel',video:'video',story:'story',print:'post',other:'post'};

// ═══════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════
let CLIENTS=[],COLLABS=[],MATS_CACHE={};
let curClient=null,selType='post',upFiles=[],activeP='week',activeT='all';
let carData={slides:[],cur:0,type:'carousel'};
let ncColor=PALETTE[0],ecColor=PALETTE[0];
let curUser=null,systemLogoUrl=null;
let sidebarCollapsed=false;
let clientTab='feed';
// Kanban state
let KANBAN_CARDS=[];
let kanbanClientFilter='all';
let kanbanDraggedId=null;
let kbDetailFiles=[]; // new attachments being added in card detail
let kbFinalizeFiles=[];
let attViewerFiles=[];
let attViewerIdx=0;
// Notifications
let NOTIFICATIONS=[];
let notifPollingInterval=null;
// To-Do
let TODO_ITEMS=[];
let todoWeekDate=getMondayOfWeek(new Date());
let todoTab='board'; // 'board' | 'done'
let mentionActive=false,mentionStart=0,mentionQuery='';
let kbNewFiles=[]; // files being attached when creating a new card
let KB_COMMENTS_CACHE={};
let USER_ROLES=[];
let curUserRole='admin'; // 'admin' | 'member', resolved on login
let ALL_MATS_LIGHT=[]; // {id,client_id,type} - contagem leve de materiais por cliente, carregada no boot

// Public form state
let PF_CLIENT=null,PF_ORGS=[],PF_STEP=1,PF_TOTAL_STEPS=6;
let PF_DATA={requester_name:'',requester_role:'',requester_contact:'',material_type:'',material_type_other:'',
  event_title:'',has_date:false,event_date:'',event_time:'',description:'',objective:'',urgency:'Normal',urgency_reason:'',
  selected_logos:[],logo_other_desc:'',logo_other_url:'',reference_files:[],reference_link:''};
let PF_REF_FILES=[];
// Org logos cache (admin) & briefings cache
let ORG_LOGOS_CACHE={};
let BRIEFINGS=[];
let curOrgLogoData=null;

// ═══════════════════════════════════════════════════
// SIDEBAR TOGGLE
// ═══════════════════════════════════════════════════
function toggleSidebar(){
  sidebarCollapsed=!sidebarCollapsed;
  const sb=document.getElementById('sidebar');
  const btn=document.getElementById('s-toggle-btn');
  sb.classList.toggle('collapsed',sidebarCollapsed);
  btn.textContent=sidebarCollapsed?'›':'‹';
  btn.title=sidebarCollapsed?'Expandir sidebar':'Recolher sidebar';
  localStorage.setItem('sidebar_collapsed',sidebarCollapsed?'1':'0');
}
function initSidebarState(){
  const saved=localStorage.getItem('sidebar_collapsed');
  if(saved==='1'){sidebarCollapsed=true;document.getElementById('sidebar').classList.add('collapsed');document.