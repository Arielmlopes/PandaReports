// Teste de RLS ponta a ponta via REST. Uso:
//   BASE=https://host/supabase ANON=<anon> SERVICE=<service_role> ADMIN_EMAIL=.. ADMIN_PASS=.. node rls-check.mjs
// Cria usuarios temporarios (rlscheck-*) e remove tudo no final.
const { BASE, ANON, SERVICE, ADMIN_EMAIL, ADMIN_PASS } = process.env
const R = (p, o = {}) => fetch(`${BASE}${p}`, o)
let fails = 0
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  -> ' + extra}`); if (!cond) fails++ }
const j = async (r) => { const t = await r.text(); try { return JSON.parse(t) } catch { return t } }
const H = (tok, extra = {}) => ({ apikey: ANON, Authorization: `Bearer ${tok || ANON}`, 'Content-Type': 'application/json', ...extra })
const rest = (tok, path, method = 'GET', body, prefer = 'return=representation') =>
  R(`/rest/v1/${path}`, { method, headers: H(tok, { Prefer: prefer }), body: body ? JSON.stringify(body) : undefined })
async function login(email, password) {
  const r = await R('/auth/v1/token?grant_type=password', { method: 'POST', headers: H(), body: JSON.stringify({ email, password }) })
  const d = await j(r); return r.ok ? d : null
}
const rpc = (tok, fn, args) => R(`/rest/v1/rpc/${fn}`, { method: 'POST', headers: H(tok), body: JSON.stringify(args) })
const suffix = Math.random().toString(36).slice(2, 8)
const PW = 'Check-Pass-123!'
const em = (n) => `rlscheck-${n}-${suffix}@example.com`

const admin = await login(ADMIN_EMAIL, ADMIN_PASS)
ok('admin login', !!admin)
const A = admin.access_token

// --- criacao de usuarios pela RPC
let r = await rpc(A, 'admin_create_user', { p_email: em('member'), p_password: PW, p_role: 'member' }); ok('admin cria member via RPC', r.ok, await r.text())
r = await rpc(A, 'admin_create_user', { p_email: em('free'), p_password: PW, p_role: 'freelancer' }); ok('admin cria freelancer via RPC', r.ok, await r.text())
r = await rpc(A, 'admin_create_user', { p_email: em('weak'), p_password: 'abc', p_role: 'member' }); ok('RPC rejeita senha curta', !r.ok)
r = await rpc(A, 'admin_create_user', { p_email: em('bad'), p_password: PW, p_role: 'root' }); ok('RPC rejeita papel invalido', !r.ok)
// usuario sem papel (criado direto no Auth)
r = await R('/auth/v1/admin/users', { method: 'POST', headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: em('none'), password: PW, email_confirm: true }) })
const noneUser = await j(r)
const M = (await login(em('member'), PW))?.access_token; ok('member criado via RPC consegue logar (compat GoTrue)', !!M)
const F = (await login(em('free'), PW))?.access_token; ok('freelancer logar', !!F)
const N = (await login(em('none'), PW))?.access_token; ok('usuario sem papel loga', !!N)

// --- RPC admin_create_user so admin
r = await rpc(M, 'admin_create_user', { p_email: em('x1'), p_password: PW, p_role: 'admin' }); ok('member NAO executa admin_create_user', !r.ok)
r = await rpc(null, 'admin_create_user', { p_email: em('x2'), p_password: PW, p_role: 'admin' }); ok('anon NAO executa admin_create_user', !r.ok)

// --- dados base (como admin)
const client = (await j(await rest(A, 'clients', 'POST', { name: 'Cliente Teste', seg: 'x' })))[0]; ok('admin cria client', !!client?.id)
const collab = (await j(await rest(A, 'collaborators', 'POST', { name: 'Free', email: em('free') })))[0]
const col = (await j(await rest(A, 'kanban_columns?select=id&limit=1')))[0]
const cardOwn = (await j(await rest(A, 'kanban_cards', 'POST', { title: 'card do free', column_id: col.id, collaborator_id: collab.id })))[0]
const cardOther = (await j(await rest(A, 'kanban_cards', 'POST', { title: 'card de outro', column_id: col.id })))[0]

// --- anon
r = await rest(null, 'clients'); let d = await j(r); ok('anon NAO le clients', !r.ok || (Array.isArray(d) && d.length === 0), JSON.stringify(d).slice(0, 80))
r = await rest(null, 'kanban_cards'); d = await j(r); ok('anon NAO le kanban_cards', !r.ok || (Array.isArray(d) && d.length === 0))
r = await rest(null, 'user_roles'); d = await j(r); ok('anon NAO le user_roles', !r.ok || (Array.isArray(d) && d.length === 0))
r = await rest(null, 'settings'); ok('anon le settings (logo do login)', r.ok)
d = await j(await rpc(null, 'get_public_client', { p_id: client.id })); ok('anon get_public_client devolve so campos publicos', d?.[0]?.name === 'Cliente Teste' && !('seg' in d[0]), JSON.stringify(d))
r = await rest(null, 'briefings', 'POST', { client_id: client.id, protocol: 'T1', title: 't', status: 'pending', files: [] }, 'return=minimal'); ok('anon cria briefing pendente', r.status === 201, await r.text())
r = await rest(null, 'briefings', 'POST', { client_id: client.id, protocol: 'T2', title: 't', status: 'approved', files: [] }, 'return=minimal'); ok('anon NAO cria briefing com status != pending', !r.ok)
r = await rest(null, 'briefings'); d = await j(r); ok('anon NAO le briefings', !r.ok || d.length === 0)
const up = (tok, path, type, body = 'x') => R(`/storage/v1/object/uploads/${path}`, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${tok || ANON}`, 'Content-Type': type }, body })
r = await up(null, `briefings/rlscheck-${suffix}/a.png`, 'image/png'); ok('anon sobe arquivo em briefings/', r.ok, await r.text())
r = await up(null, `kanban/rlscheck-${suffix}/a.png`, 'image/png'); ok('anon NAO sobe fora de briefings/', !r.ok)
r = await up(null, `briefings/rlscheck-${suffix}/a.html`, 'text/html', '<script>1</script>'); ok('anon NAO sobe text/html', !r.ok)
r = await up(null, `briefings/rlscheck-${suffix}/a.svg`, 'image/svg+xml', '<svg/>'); ok('anon NAO sobe svg', !r.ok)
r = await R('/storage/v1/object/list/uploads', { method: 'POST', headers: H(), body: JSON.stringify({ prefix: '', limit: 10 }) }); d = await j(r); ok('anon NAO lista o bucket', !r.ok || (Array.isArray(d) && d.length === 0), JSON.stringify(d).slice(0, 80))
r = await R(`/storage/v1/object/public/uploads/briefings/rlscheck-${suffix}/a.png`); ok('URL publica do arquivo continua servindo', r.ok)

// --- sem papel
for (const t of ['clients', 'kanban_cards', 'materials', 'collaborators', 'briefings', 'kanban_comments']) {
  r = await rest(N, t); d = await j(r); ok(`sem-papel NAO le ${t}`, !r.ok || (Array.isArray(d) && d.length === 0))
}
r = await rest(N, 'clients', 'POST', { name: 'hack' }); ok('sem-papel NAO cria client', !r.ok)
r = await rest(N, 'user_roles', 'POST', { email: em('none'), role: 'admin', user_id: noneUser.id }); ok('sem-papel NAO se promove a admin', !r.ok)
r = await up(N, `kanban/rlscheck-${suffix}/n.png`, 'image/png'); ok('sem-papel NAO sobe arquivo', !r.ok)
r = await rest(N, 'user_roles'); d = await j(r); ok('sem-papel ve 0 linhas de user_roles', Array.isArray(d) && d.length === 0)

// --- member
r = await rest(M, 'clients'); d = await j(r); ok('member le clients', r.ok && d.length >= 1)
r = await rest(M, 'clients', 'POST', { name: 'x' }); ok('member NAO cria client (admin only)', !r.ok)
r = await rest(M, 'user_roles?email=eq.' + encodeURIComponent(em('member')), 'PATCH', { role: 'admin' }); d = await j(r); ok('member NAO vira admin', !r.ok || d.length === 0, JSON.stringify(d))
r = await rest(M, 'kanban_cards'); d = await j(r); ok('member ve todos os cards', d.length >= 2)
r = await rest(M, 'kanban_cards', 'POST', { title: 'novo', column_id: col.id }); ok('member cria card', r.ok)
const cm = (await j(await rest(A, 'kanban_comments', 'POST', { card_id: cardOther.id, user_email: ADMIN_EMAIL, content: 'do admin' })))[0]
r = await rest(M, `kanban_comments?id=eq.${cm.id}`, 'PATCH', { content: 'hack' }); d = await j(r); ok('member NAO edita comentario alheio', !r.ok || d.length === 0)
r = await rest(M, `kanban_comments?id=eq.${cm.id}`, 'DELETE'); d = await j(r); ok('member NAO apaga comentario alheio', !r.ok || d.length === 0)
r = await rest(M, 'kanban_comments', 'POST', { card_id: cardOther.id, user_email: ADMIN_EMAIL, content: 'forjado' }); ok('member NAO forja comentario como outro usuario', !r.ok)
r = await rest(M, 'kanban_comments', 'POST', { card_id: cardOther.id, user_email: em('member'), content: 'meu' }); ok('member comenta como ele mesmo', r.ok)
await rest(A, 'notifications', 'POST', { user_email: ADMIN_EMAIL, type: 'x', title: 'so admin', body: 'b' }, 'return=minimal')
r = await rest(M, 'notifications'); d = await j(r); ok('member NAO ve notificacoes alheias', Array.isArray(d) && !d.some((n) => n.title === 'so admin'))
r = await rest(M, 'notifications', 'POST', { user_email: ADMIN_EMAIL, type: 'mention', title: 'oi', body: 'b' }, 'return=minimal'); ok('member notifica outro usuario', r.ok)

// --- freelancer
r = await rest(F, 'kanban_cards'); d = await j(r); ok('freelancer ve so os cards atribuidos', Array.isArray(d) && d.length === 1 && d[0].id === cardOwn.id, JSON.stringify(d.map?.((x) => x.title)))
r = await rest(F, `kanban_cards?id=eq.${cardOther.id}`, 'PATCH', { title: 'hack' }); d = await j(r); ok('freelancer NAO edita card alheio', !r.ok || d.length === 0)
r = await rest(F, `kanban_cards?id=eq.${cardOwn.id}`, 'PATCH', { title: 'editado' }); d = await j(r); ok('freelancer edita o proprio card', r.ok && d.length === 1)
r = await rest(F, `kanban_cards?id=eq.${cardOwn.id}`, 'PATCH', { collaborator_id: null }); d = await j(r); ok('freelancer NAO desatribui para sair da propria visao/escapar', !r.ok || d.length === 0)
r = await rest(F, `kanban_cards?id=eq.${cardOwn.id}`, 'DELETE'); d = await j(r); ok('freelancer NAO apaga card', !r.ok || d.length === 0)
r = await rest(F, 'kanban_comments?select=id'); d = await j(r); ok('freelancer NAO le comentarios de cards alheios', Array.isArray(d) && !d.some((c) => c.id === cm.id))

// --- to-do
const week = '2026-01-05'
const priv = (await j(await rest(A, 'todo_items', 'POST', { title: 'privado admin', day_of_week: 1, week_date: week, is_private: true, owner_email: ADMIN_EMAIL })))[0]
const shared = (await j(await rest(A, 'todo_items', 'POST', { title: 'compartilhado', day_of_week: 1, week_date: week, owner_email: ADMIN_EMAIL, assigned_email: em('member') })))[0]
const board = (await j(await rest(A, 'todo_boards', 'POST', { name: 'Financeiro', owner_email: ADMIN_EMAIL })))[0]
const bitem = (await j(await rest(A, 'todo_items', 'POST', { title: 'item do quadro', day_of_week: 2, week_date: week, owner_email: ADMIN_EMAIL, board_id: board.id })))[0]
d = await j(await rest(M, `todo_items?week_date=eq.${week}`)); ok('member ve item compartilhado', d.some((x) => x.id === shared.id))
ok('member NAO ve item privado do admin', !d.some((x) => x.id === priv.id))
ok('member NAO ve itens de quadro pessoal do admin', !d.some((x) => x.id === bitem.id))
d = await j(await rest(M, 'todo_boards')); ok('member NAO ve quadros do admin', Array.isArray(d) && d.length === 0)
r = await rest(M, `todo_items?id=eq.${shared.id}`, 'PATCH', { completed: true, completed_at: new Date().toISOString() }); d = await j(r); ok('member marca item compartilhado como concluido (completed_at existe)', r.ok && d.length === 1, JSON.stringify(d))
r = await rest(M, `todo_items?id=eq.${priv.id}`, 'PATCH', { title: 'hack' }); d = await j(r); ok('member NAO edita item privado alheio', !r.ok || d.length === 0)
r = await rest(M, 'todo_items', 'POST', { title: 'forjado', day_of_week: 1, week_date: week, is_private: true, owner_email: ADMIN_EMAIL }); ok('member NAO cria item privado em nome do admin', !r.ok)
d = await j(await rest(A, `todo_items?week_date=eq.${week}`)); ok('admin ve privado, compartilhado e de quadro', [priv, shared, bitem].every((i) => d.some((x) => x.id === i.id)))

// --- admin
d = await j(await rest(A, 'user_roles')); ok('admin ve user_roles', d.length >= 3)
r = await rest(A, `user_roles?email=eq.${encodeURIComponent(em('member'))}`, 'PATCH', { role: 'freelancer' }); d = await j(r); ok('admin altera papel', r.ok && d[0]?.role === 'freelancer')

// --- limpeza
const del = (path) => rest(A, path, 'DELETE', undefined, 'return=minimal')
await del(`todo_items?week_date=eq.${week}`); await del(`todo_boards?id=eq.${board.id}`)
await del(`kanban_cards?title=in.(${['card do free','card de outro','novo','editado'].map(encodeURIComponent).join(',')})`)
await del(`collaborators?id=eq.${collab.id}`); await del(`clients?id=eq.${client.id}`)
await del(`briefings?protocol=in.(T1,T2)`); await del(`notifications?title=in.(so admin,oi)`)
await del(`user_roles?email=like.rlscheck-*`)
r = await R('/storage/v1/object/uploads', { method: 'DELETE', headers: H(A), body: JSON.stringify({ prefixes: [`briefings/rlscheck-${suffix}/a.png`] }) }); if (!r.ok) console.log('aviso: nao removeu arquivo de teste', await r.text())
const users = await j(await R('/auth/v1/admin/users?per_page=200', { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } }))
for (const u of users.users || []) if (u.email?.startsWith('rlscheck-')) await R(`/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } })
console.log(fails ? `\n${fails} FALHA(S)` : '\nTODOS OS TESTES PASSARAM')
process.exit(fails ? 1 : 0)
