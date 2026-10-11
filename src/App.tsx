import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bell, CheckCircle2, ClipboardList, Clock3, FileText, LayoutDashboard, LogOut, Menu, Plus, RefreshCw, Search, Settings, ShieldCheck, Sprout, Table2, Users, Wallet, X } from 'lucide-react'
import { collection, doc, onSnapshot } from 'firebase/firestore'
import { api, ApiError, firebaseConfigError } from './lib/data'
import { firestore } from './lib/firebase'
import { formatDate, monthLabel, monthVN, todayVN } from './lib/date'
import { roleLabel, statusLabel, typeLabel } from './lib/labels'
import { calculateKpi } from './utils/kpi'
import { deadlineAlert, deadlineState, taskStatus } from './utils/tasks'
import { alertKey, markAlertsRead, watchReadAlerts } from './lib/notifications'
import { PasswordLogin } from './components/PasswordLogin'
import { AccountSetup } from './components/AccountSetup'
import { TaskForm } from './components/TaskForm'
import { TaskDetail } from './components/TaskDetail'
import { EmployeeTasks } from './components/EmployeeTasks'
import { EmployeeTaskDetail } from './components/EmployeeTaskDetail'
import { DeleteTaskDialog } from './components/DeleteTaskDialog'
import { UserForm } from './components/UserForm'
import { UserDirectory } from './components/UserDirectory'
import { ContentBoard } from './components/ContentBoard'
import { Expenses } from './components/Expenses'
import { Badge, Deadline, Empty, Loading, Modal, workLabel } from './components/TaskUi'
import type { MarketingTask, TaskStatus, UserProfile } from './types'
type Page = 'dashboard' | 'tasks' | 'content' | 'users' | 'expenses' | 'settings'
const statuses: TaskStatus[] = ['todo', 'in_progress', 'needs_revision', 'waiting_review', 'done', 'cancelled']
export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [authLoading, setAuthLoading] = useState(true); const [authError, setAuthError] = useState('')
  const [page, setPage] = useState<Page>('dashboard'); const [month, setMonth] = useState(monthVN())
  const [tasks, setTasks] = useState<MarketingTask[]>([]); const [activeTasks, setActiveTasks] = useState<MarketingTask[]>([]); const [users, setUsers] = useState<UserProfile[]>([])
  const [activeLoading, setActiveLoading] = useState(true)
  const [loading, setLoading] = useState(true); const [loadError, setLoadError] = useState('')
  const [menu, setMenu] = useState(false); const [sidebarCollapsed,setSidebarCollapsed] = useState(() => localStorage.getItem('mkt-sidebar-collapsed') === 'true'); const [inbox, setInbox] = useState(false)
  const [taskId, setTaskId] = useState<string | null>(null); const [taskFallback, setTaskFallback] = useState<MarketingTask | null>(null)
  const [liveTask, setLiveTask] = useState<MarketingTask | null>(null)
  const [deletingTasks, setDeletingTasks] = useState<MarketingTask[]>([])
  const [editing, setEditing] = useState<MarketingTask | null | 'new'>(null); const [editingUser, setEditingUser] = useState<UserProfile | null>(null)
  const [search, setSearch] = useState(''); const [status, setStatus] = useState(''); const [assignee, setAssignee] = useState(''); const [lateOnly, setLateOnly] = useState(false)
  const [now, setNow] = useState(Date.now()); const [reloadKey, setReloadKey] = useState(0)
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null)
  const [readAlerts, setReadAlerts] = useState<Record<string, string>>({}); const [readingAlerts, setReadingAlerts] = useState(false)
  const manager = !!user && user.role !== 'employee'
  const notify = useCallback((text: string, error = false) => setNotice({ text, error }), [])
  function ready(u: UserProfile) {
    setUser(u); setPage(u.role === 'employee' ? 'tasks' : 'dashboard'); setAuthError('')
    setAssignee(''); setStatus(''); setSearch(''); setLateOnly(false); setInbox(false); setEditing(null); setEditingUser(null); setDeletingTasks([])
  }
  useEffect(() => { if (firebaseConfigError) { setAuthLoading(false); return }; api.me().then(r => ready(r.user)).catch(e => { if (!(e instanceof ApiError && e.status === 401)) setAuthError(e.message) }).finally(() => setAuthLoading(false)) }, [])
  useEffect(() => {
    const refresh = () => setNow(Date.now())
    const timer = setInterval(refresh, 15_000)
    document.addEventListener('visibilitychange',refresh)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange',refresh) }
  }, [])
  useEffect(() => {
    if (!user || !user.username) return
    const id = new URLSearchParams(location.search).get('task')
    if (!id) return
    void api.task(id).then(({ task }) => { setTaskFallback(task); setTaskId(task.id); setPage('tasks'); setMonth(task.periodKey) }).catch(e => notify(e.message,true))
    history.replaceState(null,'',location.pathname)
  }, [user, notify])
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(null), 6500); return () => clearTimeout(timer) }, [notice])
  useEffect(() => {
    if (!user) return
    setLoading(true); setTasks([]); setLoadError('')
    return api.watchTasks(user, month, values => { setTasks(values); setLoading(false) }, e => { setTasks([]); setLoadError(e.message); setLoading(false) })
  }, [user, month, reloadKey])
  useEffect(() => {
    if (!user || !user.username || !firestore) return
    setActiveLoading(true)
    const stopActive = api.watchTasks(user, null, values => { setActiveTasks(values); setActiveLoading(false) }, e => { setActiveTasks([]); setActiveLoading(false); setLoadError(e.message) })
    const revokeSession = () => {
      setTasks([]); setActiveTasks([]); setUsers([]); setTaskId(null); setTaskFallback(null); setLiveTask(null); setDeletingTasks([]); setEditing(null); setEditingUser(null); setInbox(false)
      void api.logout(); setUser(null); setAuthError('Tài khoản đã bị thu hồi quyền truy cập. Liên hệ ADMIN hoặc quản lý để được cấp lại quyền.')
    }
    const stopAccess = onSnapshot(doc(firestore, 'employeeAccess', user.email.toLowerCase()), snap => {
      if (snap.exists() && !snap.data().active) revokeSession()
    }, () => {})
    const stopMe = onSnapshot(doc(firestore, 'users', user.uid), snap => {
      if (snap.exists() && (!snap.data().active || snap.data().role !== user.role || snap.data().fullName !== user.fullName)) {
        setTasks([]); setActiveTasks([]); setUsers([]); setTaskId(null); setTaskFallback(null); setDeletingTasks([])
        if (!snap.data().active) revokeSession()
        else ready({ ...user, ...snap.data() } as UserProfile)
      }
    })
    const stopUsers = manager ? onSnapshot(collection(firestore, 'users'), snap => setUsers(snap.docs.map(s => ({ ...s.data(), uid: s.id } as UserProfile)).sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'))), e => setLoadError(e.message)) : () => {}
    return () => { stopActive(); stopMe(); stopUsers(); stopAccess() }
  }, [user, manager, notify])
  useEffect(() => {
    setReadAlerts({})
    if (!user) return
    return watchReadAlerts(user.uid,setReadAlerts,() => notify('Chưa đồng bộ được trạng thái đã đọc thông báo.',true))
  }, [user?.uid, notify])
  useEffect(() => {
    setLiveTask(null)
    if (!taskId || !user) return
    return api.watchTask(taskId,value => { setLiveTask(value); if (!value) { setTaskId(null); setTaskFallback(null) } },e => { setTaskId(null); notify(e.message,true) })
  }, [taskId,user?.uid,notify])
  const alerts = useMemo(() => activeTasks.filter(t => deadlineAlert(t, now, manager ? undefined : user?.uid)), [activeTasks, now, manager, user?.uid])
  const unread = alerts.filter(t => readAlerts[t.id] !== alertKey(t,deadlineAlert(t,now,manager ? undefined : user?.uid)!))
  const chosenTask = (liveTask?.id === taskId ? liveTask : null) || tasks.find(t => t.id === taskId) || activeTasks.find(t => t.id === taskId) || taskFallback
  function openTask(t: MarketingTask) {
    setTaskFallback(t); setTaskId(t.id); setInbox(false)
    if (user && deadlineAlert(t,now,manager ? undefined : user.uid)) void markAlertsRead(user.uid,[t],now,manager ? undefined : user.uid).catch(() => notify('Chưa lưu được trạng thái đã đọc.',true))
  }
  async function action(fn: () => Promise<unknown>, message: string) { const result = await fn() as { task?: MarketingTask }; if (result?.task) setTaskFallback(result.task); notify(message) }
  function requestDelete(selected: MarketingTask[]) {
    if (user?.role !== 'admin') return
    setTaskId(null); setTaskFallback(null); setLiveTask(null); setDeletingTasks(selected)
  }
  function tasksDeleted(ids: string[]) {
    const removed = new Set(ids)
    setTasks(values => values.filter(t => !removed.has(t.id))); setActiveTasks(values => values.filter(t => !removed.has(t.id)))
    setTaskId(value => value && removed.has(value) ? null : value); setTaskFallback(value => value && removed.has(value.id) ? null : value); setLiveTask(value => value && removed.has(value.id) ? null : value)
    setDeletingTasks([]); notify(`Đã xóa ${ids.length} công việc. SKU tự động sẽ tiếp tục tăng, không lấp số đã xóa.`)
  }
  async function logout() {
    if (!user) return
    try { await api.logout(); setUser(null); setTasks([]); setActiveTasks([]); setUsers([]); setTaskId(null); setTaskFallback(null); setEditing(null); setDeletingTasks([]); setInbox(false) } catch (e) { notify((e as Error).message, true) }
  }
  async function readAllAlerts() {
    if (!user) return
    setReadingAlerts(true)
    try { await markAlertsRead(user.uid,unread,now,manager ? undefined : user.uid) } catch { notify('Chưa lưu được trạng thái đã đọc.',true) } finally { setReadingAlerts(false) }
  }
  const filtered = tasks.filter(t => (!search || `${t.title} ${Object.values(t.assignments).map(a => a.fullName).join(' ')}`.toLowerCase().includes(search.toLowerCase())) && (!status || taskStatus(t) === status) && (!assignee || t.assigneeUids.includes(assignee)) && (!lateOnly || deadlineState(t, now) === 'late'))
  const kpi = calculateKpi(tasks, month, now)
  const title = page === 'dashboard' ? 'Tổng quan SALE - MARKETING' : page === 'content' ? 'Bảng nội dung SALE - MARKETING' : page === 'tasks' ? manager ? 'Công việc của đội ngũ' : 'Công việc của tôi' : page === 'users' ? 'Đội ngũ SALE - MARKETING' : page === 'expenses' ? 'Chi phí & doanh thu' : 'Tài khoản & thông báo'
  if (authLoading) return <div className="full-loading"><Loading /></div>
  if (firebaseConfigError) return <div className="full-loading"><p className="form-error">{firebaseConfigError}</p></div>
  if (!user) return <PasswordLogin onReady={ready} initialError={authError} />
  if (!user.username && user.role==='admin') return <AccountSetup user={user} onReady={ready} logout={logout}/>
  return <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}><div className={`sidebar-scrim ${menu ? 'show' : ''}`} onClick={() => setMenu(false)} /><aside className={`sidebar ${menu ? 'open' : ''}`}>
    <div className="sidebar-brand">
      <span className="brand-icon" aria-hidden="true"><Sprout size={24} strokeWidth={2} /></span>
      <span className="sidebar-brand-name"><strong>VUA TỎI</strong><small>SALE - MARKETING</small></span>
      <button className="mobile-close icon-button" onClick={() => setMenu(false)} aria-label="Đóng menu"><X size={20} /></button>
    </div>
    <div className="nav-heading">SALE - MARKETING</div><nav className="nav-list">{([{ id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard, show: manager }, { id: 'tasks', label: manager ? 'Công việc' : 'Công việc của tôi', icon: ClipboardList, show: true }, { id: 'content', label: 'Bảng nội dung', icon: Table2, show: manager }, { id: 'users', label: 'Nhân sự', icon: Users, show: manager }, { id: 'expenses', label: 'Chi phí', icon: Wallet, show: manager }, { id: 'settings', label: 'Cài đặt', icon: Settings, show: true }] as const).filter(n => n.show).map(n => <button className={`nav-item ${page === n.id ? 'active' : ''}`} key={n.id} aria-label={n.label} title={n.label} onClick={() => { setPage(n.id); setMenu(false) }}><n.icon size={19} /><span>{n.label}</span></button>)}</nav>
    <div className="sidebar-spacer" /><div className="sidebar-help"><span className="help-icon"><FileText size={18} /></span><b>Cùng nhau tạo nội dung</b><p>Kịch bản, media và kết quả trong cùng một công việc.</p></div>
    <div className="sidebar-user"><span className="avatar">{user.fullName[0]}</span><div><b>{user.fullName}</b><small>{roleLabel[user.role]}</small></div><button className="icon-button" aria-label="Đăng xuất" onClick={logout}><LogOut size={18} /></button></div>
  </aside><div className="main-shell"><header className="topbar"><div className="topbar-left"><button className="menu-button icon-button" aria-label="Mở menu" onClick={() => setMenu(true)}><Menu size={22} /></button><button className="desktop-menu-toggle icon-button" aria-label={sidebarCollapsed ? 'Mở rộng menu trái' : 'Thu gọn menu trái'} aria-expanded={!sidebarCollapsed} onClick={() => { const next=!sidebarCollapsed; setSidebarCollapsed(next); localStorage.setItem('mkt-sidebar-collapsed',String(next)) }}><Menu size={21}/></button><div className="breadcrumb"><span className="breadcrumb-workspace">SALE - MARKETING · VUA TỎI</span><span className="breadcrumb-divider">/</span><b>{page === 'tasks' ? 'Công việc' : page === 'users' ? 'Nhân sự' : page === 'settings' ? 'Cài đặt' : page === 'content' ? 'Bảng nội dung' : page === 'expenses' ? 'Chi phí' : 'Tổng quan'}</b></div></div><div className="topbar-right"><span className="top-date">{formatDate(todayVN())}</span><button className="icon-button reload" aria-label="Tải lại dữ liệu" onClick={() => setReloadKey(k => k + 1)}><RefreshCw size={18} /></button><button className="icon-button notification-bell" aria-label={`Thông báo deadline (${unread.length} chưa đọc)`} onClick={() => setInbox(!inbox)}><Bell size={19} />{unread.length > 0 && <span>{unread.length}</span>}</button><span className="top-avatar">{user.fullName[0]}</span></div></header>
    {inbox && <section className="notification-inbox"><div className="panel-heading"><div><h2>Thông báo deadline</h2><p>{unread.length} chưa đọc · Cảnh báo của tài khoản đang đăng nhập</p></div><button className="icon-button" aria-label="Đóng thông báo" onClick={() => setInbox(false)}><X size={18} /></button></div>{alerts.length ? alerts.map(t => <button key={t.id} className={`upcoming-item ${unread.includes(t) ? 'alert-unread' : ''}`} onClick={() => openTask(t)}><Clock3 size={17} /><span className="upcoming-content"><b>{t.title}</b><small>{Object.values(t.assignments).map(a => a.fullName).join(', ')}</small></span><Deadline task={t} now={now} /></button>) : <Empty title="Chưa có cảnh báo" text="Task còn 30 phút hoặc trễ hạn sẽ xuất hiện tại đây." />}<div className="inbox-footer"><button disabled={readingAlerts || !unread.length} className="button soft" onClick={readAllAlerts}>{readingAlerts ? 'Đang lưu…' : 'Đánh dấu tất cả đã đọc'}</button></div></section>}
    <main className={`main-content ${page === 'content' ? 'content-workspace' : ''}`}><div className="page-head"><div><div className="eyebrow">SALE - MARKETING · VUA TỎI</div><h1>{title}</h1><p>{page === 'users' ? 'Quản lý thành viên, quyền truy cập và lịch sử công việc của đội ngũ.' : page === 'settings' ? 'Quản lý tài khoản và nhắc deadline trên thiết bị của bạn.' : page === 'expenses' ? 'Theo dõi chi phí vận hành và doanh thu bán lẻ của đội ngũ.' : page === 'content' ? 'Từ kịch bản đến đăng Page, theo dõi mọi nội dung trong một bảng.' : !manager && page === 'tasks' ? 'Xem phần việc của bạn, theo dõi deadline và nộp kết quả tại một nơi.' : 'Phối hợp Content & Media, theo dõi thời hạn và kết quả chung.'}</p></div>{['dashboard', 'tasks', 'content', 'expenses'].includes(page) && <div className="action-row"><label className="month-picker"><Clock3 size={17} /><span>{monthLabel(month)}</span><input type="month" aria-label="Chọn tháng" value={month} onChange={e => setMonth(e.target.value)} /></label>{manager && page !== 'expenses' && <button className="button primary" onClick={() => setEditing('new')}><Plus size={18} />Tạo công việc</button>}</div>}</div>
    {loadError && <p className="load-error">{loadError}<button onClick={() => setReloadKey(k => k + 1)}>Thử lại</button></p>}
    {page === 'dashboard' && <>{loading ? <Loading /> : <><div className="kpi-grid">{[{ label: 'Tổng công việc', value: kpi.total, tone: 'blue', text: 'Trong tháng đang chọn' }, { label: 'Đã hoàn thành', value: kpi.done, tone: 'green', text: 'Được quản lý duyệt' }, { label: 'Đang thực hiện', value: kpi.inProgress, tone: 'indigo', text: 'Đang làm / chỉnh sửa' }, { label: 'Chờ duyệt', value: kpi.waitingReview, tone: 'orange', text: 'Đã nộp đủ phần việc' }, { label: 'Trễ hạn', value: kpi.overdue, tone: 'red', text: 'Chưa nộp / nộp trễ' }, { label: 'Hoàn thành đúng hạn', value: kpi.onTime, tone: 'cyan', text: 'Theo thời điểm nộp đủ' }].map(k => <div className="kpi-card" key={k.label}><span className={`kpi-icon ${k.tone}`}><ClipboardList size={18} /></span><div className="kpi-label">{k.label}</div><div className="kpi-value">{k.value}</div><div className="kpi-detail">{k.text}</div></div>)}</div>
      <div className="dashboard-bottom"><section className="panel"><div className="panel-heading"><div><h2>Kết quả theo nhân viên</h2><p>Một task có thể có nhiều thành viên cùng thực hiện</p></div><Users size={18} /></div>{users.filter(u => u.role === 'employee' && !u.archived).length ? <div className="table-scroll"><table><thead><tr><th>Nhân viên</th><th>Được giao</th><th>Đã nộp</th><th>Hoàn thành</th><th>Trễ phần việc</th></tr></thead><tbody>{users.filter(u => u.role === 'employee' && !u.archived).map(u => { const ownTasks = tasks.filter(t => t.assigneeUids.includes(u.uid) && t.status !== 'cancelled'); return <tr key={u.uid} className="clickable" onClick={() => { setAssignee(u.uid); setPage('tasks') }}><td><span className="person-cell"><span className="avatar small">{u.fullName[0]}</span><b>{u.fullName}</b></span></td><td>{ownTasks.length}</td><td>{ownTasks.filter(t => t.contributions[u.uid]?.status === 'submitted').length}</td><td>{ownTasks.filter(t => t.status === 'done').length}</td><td className="danger-text">{ownTasks.filter(t => t.contributions[u.uid]?.submittedAt ? Date.parse(t.contributions[u.uid].submittedAt!) > Date.parse(t.deadlineAt) : deadlineState(t, now) === 'late').length}</td></tr> })}</tbody></table></div> : <Empty title="Mời đội ngũ bắt đầu" text="ADMIN cấp tài khoản trong mục Nhân sự để bắt đầu giao việc." />}</section>
      <section className="panel upcoming"><div className="panel-heading"><div><h2>Deadline cần theo dõi</h2><p>Các công việc sắp đến hạn</p></div><Clock3 size={18} /></div>{activeTasks.filter(t => !['done', 'cancelled', 'waiting_review'].includes(taskStatus(t))).slice(0, 6).map(t => <button className="upcoming-item" key={t.id} onClick={() => openTask(t)}><span className={`upcoming-line ${deadlineState(t, now) === 'late' ? 'late' : ''}`} /><span className="upcoming-content"><b>{t.title}</b><small>{Object.values(t.assignments).map(a => a.fullName).join(', ')}</small></span><Deadline task={t} now={now} /></button>)}{!activeTasks.length && <Empty title="Chưa có công việc" text="Tạo task và giao phần việc cho đội ngũ." />}</section></div></>}</>}
    {page === 'tasks' && !manager && <EmployeeTasks tasks={tasks} activeTasks={activeTasks} user={user} month={month} now={now} loading={loading} activeLoading={activeLoading} openTask={openTask} />}
    {page === 'tasks' && manager && <section className="panel task-panel"><div className="filter-row"><div className="search-box"><Search size={17} /><input aria-label="Tìm công việc" value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm công việc, nhân viên…" /></div><select aria-label="Lọc trạng thái" value={status} onChange={e => setStatus(e.target.value)}><option value="">Tất cả trạng thái</option>{statuses.map(s => <option key={s} value={s}>{statusLabel[s]}</option>)}</select>{manager && <select aria-label="Lọc nhân viên" value={assignee} onChange={e => setAssignee(e.target.value)}><option value="">Tất cả nhân viên</option>{users.filter(u => u.role === 'employee' && !u.archived).map(u => <option value={u.uid} key={u.uid}>{u.fullName}</option>)}</select>}<label className="filter-check"><input type="checkbox" checked={lateOnly} onChange={e => setLateOnly(e.target.checked)} />Chỉ trễ hạn</label></div>
      {loading ? <Loading /> : filtered.length ? <div className="task-cards">{filtered.map(t => <button className="task-card" key={t.id} onClick={() => openTask(t)}><div className="task-card-top"><span className="task-kind">{typeLabel[t.taskType]}</span><Badge task={t} /></div><h3>{t.title}</h3><p>{t.description || 'Chưa có mô tả'}</p><div className="task-members">{t.assigneeUids.map(uid => <span key={uid} title={workLabel[t.assignments[uid].workRole]}><i className="avatar tiny">{t.assignments[uid].fullName[0]}</i>{t.assignments[uid].fullName}<b>{t.contributions[uid]?.status === 'submitted' ? '✓' : ''}</b></span>)}</div><div className="task-card-bottom"><Deadline task={t} now={now} /><span>{t.assigneeUids.filter(uid => t.contributions[uid]?.status === 'submitted').length}/{t.assigneeUids.length} đã nộp</span></div></button>)}</div> : <Empty title="Chưa có công việc phù hợp" text={manager ? 'Tạo công việc mới hoặc đổi bộ lọc.' : 'Công việc được giao sẽ hiển thị tại đây.'} />}<div className="table-footer">{filtered.length} công việc · {monthLabel(month)}</div></section>}
    {page === 'content' && manager && <ContentBoard month={month} tasks={tasks} users={users} onCreated={periodKey => setMonth(periodKey)} user={user} now={now} loading={loading} openTask={openTask} requestDelete={requestDelete} action={action} />}
    {page === 'users' && manager && <UserDirectory users={users} actor={user} edit={setEditingUser} action={action} />}
    {page === 'expenses' && manager && <Expenses key={user.uid} uid={user.uid} month={month} changeMonth={setMonth} />}
    {page === 'settings' && <><div className="settings-grid"><section className="panel settings-panel"><h2>Tài khoản</h2><div className="settings-person"><span className="avatar large">{user.fullName[0]}</span><div><b>{user.fullName}</b><small>{user.username || user.email}</small></div></div><div className="settings-row"><span>Vai trò</span><b>{roleLabel[user.role]}</b></div><div className="settings-row"><span>Không gian</span><b>SALE - MARKETING · VUA TỎI</b></div><p className="form-help">Tài khoản do ADMIN cấp. Liên hệ ADMIN khi cần đổi mật khẩu.</p></section><section className="panel settings-panel"><h2>Thông báo trong tài khoản</h2><p className="muted">Cảnh báo tại biểu tượng chuông khi còn tối đa 30 phút và khi quá deadline.</p><div className="settings-row"><span>Trạng thái</span><b>Đang hoạt động</b></div><div className="settings-row"><span>Phạm vi của bạn</span><b>{manager ? 'Toàn đội SALE - MARKETING' : 'Phần việc được giao'}</b></div><div className="settings-row"><span>Chưa đọc</span><b>{unread.length} thông báo</b></div><button className="button soft" onClick={() => setInbox(true)}><Bell size={16} />Mở thông báo</button><p className="form-help">Người đã nộp không bị nhắc tiếp. ADMIN và quản lý được nhắc đến khi cả đội nộp đủ. Trạng thái đã đọc được lưu theo tài khoản.</p></section></div><section className="panel help-panel"><ShieldCheck size={21} /><div><h2>Phần việc và deadline</h2><p>Mỗi người nộp kết quả riêng trong cùng task. Khi đủ kết quả, task chuyển sang chờ duyệt. Thời gian nộp đủ được dùng để đánh giá đúng hạn, dù ADMIN duyệt sau đó.</p></div></section></>}
    </main></div>
    {taskId && chosenTask && <Modal title={chosenTask.title} close={() => setTaskId(null)}>{manager ? <TaskDetail key={chosenTask.id} task={chosenTask} user={user} now={now} edit={() => { setEditing(chosenTask); setTaskId(null) }} requestDelete={() => requestDelete([chosenTask])} action={action} /> : <EmployeeTaskDetail key={chosenTask.id} task={chosenTask} user={user} now={now} action={action} />}</Modal>}
    {deletingTasks.length > 0 && user.role === 'admin' && <DeleteTaskDialog key={deletingTasks.map(t => t.id).join(',')} tasks={deletingTasks} close={() => setDeletingTasks([])} deleted={tasksDeleted} />}
    {editing && <Modal title={editing === 'new' ? 'Tạo công việc' : 'Sửa công việc'} close={() => setEditing(null)}><TaskForm existing={editing === 'new' ? undefined : editing} users={users} save={async data => { await action(() => editing === 'new' ? api.createTask(data) : api.updateTask(editing.id, data), editing === 'new' ? 'Đã giao công việc cho đội ngũ.' : 'Đã cập nhật công việc.'); setEditing(null) }} /></Modal>}
    {editingUser && <Modal title="Cập nhật nhân sự" close={() => setEditingUser(null)}><UserForm self={editingUser.uid===user.uid} user={editingUser} save={async data => { await action(() => api.updateUser(editingUser.uid, data), 'Đã cập nhật nhân sự.'); setEditingUser(null) }} /></Modal>}
    {notice && <div className={`notice ${notice.error ? 'error' : 'success'}`} role="status"><span><CheckCircle2 size={18} /></span><p>{notice.text}</p><button className="icon-button" aria-label="Đóng" onClick={() => setNotice(null)}><X size={16} /></button></div>}
  </div>
}

