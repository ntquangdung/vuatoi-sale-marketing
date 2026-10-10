import { createServer } from 'node:http'
import { DatabaseSync } from 'node:sqlite'
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const dataDir = resolve(process.env.DATA_DIR || resolve(process.cwd(), '.data'))
mkdirSync(dataDir, { recursive: true })
const db = new DatabaseSync(resolve(dataDir, 'marketing.sqlite'))
db.exec(`PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS users (uid TEXT PRIMARY KEY, full_name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, role TEXT NOT NULL, active INTEGER NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, period_key TEXT NOT NULL, assignee_uid TEXT NOT NULL, due_date TEXT NOT NULL, status TEXT NOT NULL, data TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS tasks_period ON tasks(period_key);
CREATE INDEX IF NOT EXISTS tasks_assignee_period ON tasks(assignee_uid, period_key);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, uid TEXT NOT NULL, expires_at INTEGER NOT NULL);`)

const roles = ['admin', 'manager', 'employee']
const statuses = ['todo', 'in_progress', 'waiting_review', 'needs_revision', 'done', 'cancelled']
const taskTypes = ['video', 'content', 'seo', 'design', 'other']
const priorities = ['low', 'normal', 'high', 'urgent']
const publicationStatuses = ['not_applicable', 'not_scheduled', 'scheduled', 'published']
const dateRe = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
const text = (value, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : ''
const todayVN = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const now = () => new Date().toISOString()
const isDate = value => typeof value === 'string' && dateRe.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
const validUrl = value => { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) } catch { return false } }
const fail = (status, message) => { const error = new Error(message); error.status = status; throw error }
const publicUser = row => row && ({ uid: row.uid, fullName: row.full_name, email: row.email, role: row.role, active: Boolean(row.active), createdAt: row.created_at, updatedAt: row.updated_at })
const getUser = uid => db.prepare('SELECT * FROM users WHERE uid = ?').get(uid)
const hashPassword = password => { const salt = randomBytes(16).toString('hex'); return `${salt}:${scryptSync(password, salt, 64).toString('hex')}` }
const verifyPassword = (password, stored) => { const [salt, hash] = stored.split(':'); const left = Buffer.from(hash, 'hex'); const right = scryptSync(password, salt, 64); return left.length === right.length && timingSafeEqual(left, right) }
const tokenHash = token => createHash('sha256').update(token).digest('hex')

function getSession(req) {
  const token = /(?:^|; )session=([^;]+)/.exec(req.headers.cookie || '')?.[1]
  if (!token) return null
  const session = db.prepare('SELECT uid FROM sessions WHERE token_hash = ? AND expires_at > ?').get(tokenHash(token), Date.now())
  return session ? getUser(session.uid) : null
}
function requireUser(req) { const user = getSession(req); if (!user) fail(401, 'Vui lòng đăng nhập.'); if (!user.active) fail(403, 'Tài khoản đã bị khóa. Vui lòng liên hệ ADMIN.'); return user }
function requireManager(req) { const user = requireUser(req); if (user.role === 'employee') fail(403, 'Bạn không có quyền thực hiện thao tác này.'); return user }
function requireAdmin(req) { const user = requireUser(req); if (user.role !== 'admin') fail(403, 'Chỉ ADMIN có quyền quản lý nhân sự.'); return user }
function write(res, status, body, headers = {}) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }); res.end(JSON.stringify(body)) }
async function body(req) {
  let value = ''
  for await (const chunk of req) { value += chunk; if (value.length > 100_000) fail(413, 'Dữ liệu gửi lên quá lớn.') }
  try { return value ? JSON.parse(value) : {} } catch { fail(400, 'Dữ liệu gửi lên không hợp lệ.') }
}
function taskById(id) { const row = db.prepare('SELECT data FROM tasks WHERE id = ?').get(id); return row && JSON.parse(row.data) }
function saveTask(task) { db.prepare('UPDATE tasks SET period_key = ?, assignee_uid = ?, due_date = ?, status = ?, data = ? WHERE id = ?').run(task.periodKey, task.assigneeUid, task.dueDate, task.status, JSON.stringify(task), task.id) }
function publication(input, required, plannedDate, previous = null) {
  if (!required) return { publicationStatus: 'not_applicable', plannedPublishDate: null, publishedDate: null, postUrl: null }
  if (plannedDate !== null && !isDate(plannedDate)) fail(400, 'Ngày đăng dự kiến không hợp lệ.')
  const publicationStatus = input.publicationStatus ?? previous?.publicationStatus ?? (plannedDate ? 'scheduled' : 'not_scheduled')
  if (!publicationStatuses.includes(publicationStatus) || publicationStatus === 'not_applicable') fail(400, 'Trạng thái đăng không hợp lệ.')
  const publishedDate = input.publishedDate || null
  const postUrl = text(input.postUrl, 2000) || null
  if (publicationStatus === 'published' && (!isDate(publishedDate) || !validUrl(postUrl))) fail(400, 'Đã đăng cần ngày đăng thực tế và URL http/https hợp lệ.')
  if (publicationStatus === 'scheduled' && !plannedDate) fail(400, 'Chọn ngày đăng dự kiến hoặc trạng thái chưa có lịch.')
  return { publicationStatus, plannedPublishDate: plannedDate, publishedDate: publicationStatus === 'published' ? publishedDate : null, postUrl: publicationStatus === 'published' ? postUrl : null }
}
function taskInput(input) {
  const title = text(input.title, 180), description = text(input.description, 5000)
  if (!title) fail(400, 'Vui lòng nhập tên công việc.')
  if (!taskTypes.includes(input.taskType)) fail(400, 'Loại công việc không hợp lệ.')
  if (!priorities.includes(input.priority)) fail(400, 'Độ ưu tiên không hợp lệ.')
  if (!isDate(input.dueDate)) fail(400, 'Hạn hoàn thành không hợp lệ.')
  const assignee = getUser(input.assigneeUid)
  if (!assignee || !assignee.active || assignee.role !== 'employee') fail(400, 'Nhân viên phụ trách không hợp lệ hoặc đã khóa.')
  const requiresPublishing = input.requiresPublishing === true
  const plannedPublishDate = requiresPublishing && input.plannedPublishDate ? input.plannedPublishDate : null
  return { title, description, taskType: input.taskType, priority: input.priority, dueDate: input.dueDate, periodKey: input.dueDate.slice(0, 7), assigneeUid: assignee.uid, assigneeName: assignee.full_name, requiresPublishing, ...publication({}, requiresPublishing, plannedPublishDate) }
}
function validateUserInput(input, creating = false) {
  const fullName = text(input.fullName, 120), email = text(input.email, 254).toLowerCase()
  if (!fullName || !/^\S+@\S+\.\S+$/.test(email)) fail(400, 'Họ tên hoặc email không hợp lệ.')
  if (!roles.includes(input.role)) fail(400, 'Vai trò không hợp lệ.')
  if (creating && (typeof input.password !== 'string' || input.password.length < 8)) fail(400, 'Mật khẩu cần ít nhất 8 ký tự.')
  return { fullName, email, role: input.role, active: input.active !== false }
}
function ensureTaskAccess(user, task) { if (!task) fail(404, 'Không tìm thấy công việc.'); if (user.role === 'employee' && task.assigneeUid !== user.uid) fail(403, 'Bạn không có quyền xem công việc này.') }
const loginAttempts = new Map()

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost')
    const path = url.pathname
    if (!path.startsWith('/api/')) { write(res, 404, { error: 'Không tìm thấy.' }); return }
    if (!['GET', 'HEAD'].includes(req.method)) {
      const origin = req.headers.origin
      const host = req.headers.host
      if (origin && new URL(origin).host !== host && !(host === '127.0.0.1:8787' && /^http:\/\/(127\.0\.0\.1|localhost):5173$/.test(origin))) fail(403, 'Nguồn yêu cầu không hợp lệ.')
    }
    if (req.method === 'GET' && path === '/api/bootstrap-status') { write(res, 200, { needsSetup: db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0 }); return }
    if (req.method === 'POST' && path === '/api/bootstrap') {
      const input = await body(req), user = validateUserInput({ ...input, role: 'admin' }, true), uid = randomUUID(), stamp = now()
      db.exec('BEGIN IMMEDIATE')
      try {
        if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n !== 0) fail(403, 'Hệ thống đã được khởi tạo.')
        db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(uid, user.fullName, user.email, 'admin', 1, hashPassword(input.password), stamp, stamp)
        db.exec('COMMIT')
      } catch (error) { db.exec('ROLLBACK'); throw error }
      write(res, 201, { message: 'Đã tạo tài khoản ADMIN. Vui lòng đăng nhập.' }); return
    }
    if (req.method === 'POST' && path === '/api/login') {
      const input = await body(req), email = text(input.email, 254).toLowerCase(), key = `${req.socket.remoteAddress}:${email}`
      const attempt = loginAttempts.get(key)
      if (attempt && attempt.count >= 5 && attempt.until > Date.now()) fail(429, 'Đăng nhập quá nhiều lần. Vui lòng thử lại sau 15 phút.')
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
      if (!user || !verifyPassword(String(input.password || ''), user.password_hash)) {
        loginAttempts.set(key, { count: (attempt?.until > Date.now() ? attempt.count : 0) + 1, until: Date.now() + 15 * 60_000 })
        fail(401, 'Email hoặc mật khẩu không đúng.')
      }
      if (!user.active) fail(403, 'Tài khoản đã bị khóa. Vui lòng liên hệ ADMIN.')
      loginAttempts.delete(key)
      const token = randomBytes(32).toString('base64url')
      db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(tokenHash(token), user.uid, Date.now() + 7 * 86_400_000)
      write(res, 200, { user: publicUser(user) }, { 'Set-Cookie': `session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800` }); return
    }
    if (req.method === 'POST' && path === '/api/logout') {
      const token = /(?:^|; )session=([^;]+)/.exec(req.headers.cookie || '')?.[1]
      if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(token))
      write(res, 200, { ok: true }, { 'Set-Cookie': 'session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' }); return
    }
    if (req.method === 'GET' && path === '/api/me') { write(res, 200, { user: publicUser(requireUser(req)) }); return }
    if (req.method === 'POST' && path === '/api/change-password') {
      const user = requireUser(req), input = await body(req)
      if (!verifyPassword(String(input.currentPassword || ''), user.password_hash)) fail(400, 'Mật khẩu hiện tại không đúng.')
      if (typeof input.newPassword !== 'string' || input.newPassword.length < 8) fail(400, 'Mật khẩu mới cần ít nhất 8 ký tự.')
      db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE uid = ?').run(hashPassword(input.newPassword), now(), user.uid)
      db.prepare('DELETE FROM sessions WHERE uid = ?').run(user.uid)
      write(res, 200, { ok: true }, { 'Set-Cookie': 'session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' }); return
    }
    if (req.method === 'GET' && path === '/api/users') {
      requireManager(req)
      write(res, 200, { users: db.prepare('SELECT * FROM users ORDER BY full_name').all().map(publicUser) }); return
    }
    if (req.method === 'POST' && path === '/api/users') {
      requireAdmin(req)
      const input = await body(req), value = validateUserInput(input, true), stamp = now(), uid = randomUUID()
      db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(uid, value.fullName, value.email, value.role, Number(value.active), hashPassword(input.password), stamp, stamp)
      write(res, 201, { user: publicUser(getUser(uid)) }); return
    }
    const userMatch = /^\/api\/users\/([^/]+)$/.exec(path)
    if (req.method === 'PATCH' && userMatch) {
      const admin = requireAdmin(req), uid = userMatch[1], existing = getUser(uid)
      if (!existing) fail(404, 'Không tìm thấy nhân sự.')
      const input = await body(req), value = validateUserInput({ ...publicUser(existing), ...input })
      if (admin.uid === uid && (!value.active || value.role !== 'admin')) fail(400, 'Không thể tự khóa hoặc hạ quyền tài khoản ADMIN đang dùng.')
      if (input.password !== undefined && (typeof input.password !== 'string' || input.password.length < 8)) fail(400, 'Mật khẩu mới cần ít nhất 8 ký tự.')
      db.prepare('UPDATE users SET full_name = ?, email = ?, role = ?, active = ?, password_hash = ?, updated_at = ? WHERE uid = ?').run(value.fullName, value.email, value.role, Number(value.active), input.password ? hashPassword(input.password) : existing.password_hash, now(), uid)
      if (!value.active || input.password) db.prepare('DELETE FROM sessions WHERE uid = ?').run(uid)
      write(res, 200, { user: publicUser(getUser(uid)) }); return
    }
    if (req.method === 'GET' && path === '/api/tasks') {
      const user = requireUser(req), period = url.searchParams.get('period')
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period || '')) fail(400, 'Tháng không hợp lệ.')
      const rows = user.role === 'employee'
        ? db.prepare('SELECT data FROM tasks WHERE period_key = ? AND assignee_uid = ? ORDER BY due_date, id').all(period, user.uid)
        : db.prepare('SELECT data FROM tasks WHERE period_key = ? ORDER BY due_date, id').all(period)
      write(res, 200, { tasks: rows.map(row => JSON.parse(row.data)) }); return
    }
    if (req.method === 'GET' && path === '/api/dashboard') {
      requireManager(req)
      const period = url.searchParams.get('period')
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period || '')) fail(400, 'Tháng không hợp lệ.')
      const rows = db.prepare('SELECT data FROM tasks WHERE period_key = ? OR json_extract(data, \'$.plannedPublishDate\') LIKE ?').all(period, `${period}-%`)
      write(res, 200, { tasks: rows.map(row => JSON.parse(row.data)) }); return
    }
    const taskMatch = /^\/api\/tasks\/([^/]+)$/.exec(path)
    if (req.method === 'GET' && taskMatch) { const user = requireUser(req), task = taskById(taskMatch[1]); ensureTaskAccess(user, task); write(res, 200, { task }); return }
    if (req.method === 'POST' && path === '/api/tasks') {
      const user = requireManager(req), input = taskInput(await body(req)), stamp = now(), id = randomUUID()
      const task = { id, ...input, createdByUid: user.uid, createdByName: user.full_name, status: 'todo', progressPercent: 0, completionNote: '', createdAt: stamp, updatedAt: stamp, submittedAt: null, completedAt: null, completedDate: null }
      db.prepare('INSERT INTO tasks VALUES (?, ?, ?, ?, ?, ?)').run(id, task.periodKey, task.assigneeUid, task.dueDate, task.status, JSON.stringify(task))
      write(res, 201, { task }); return
    }
    if (req.method === 'PATCH' && taskMatch) {
      requireManager(req)
      const task = taskById(taskMatch[1]); if (!task) fail(404, 'Không tìm thấy công việc.')
      if (task.status === 'cancelled') fail(400, 'Công việc đã hủy không thể chỉnh sửa.')
      const patch = taskInput(await body(req))
      if (patch.requiresPublishing && task.requiresPublishing) {
        patch.publicationStatus = task.publicationStatus === 'scheduled' && !patch.plannedPublishDate ? 'not_scheduled' : task.publicationStatus
        patch.publishedDate = task.publishedDate
        patch.postUrl = task.postUrl
      }
      Object.assign(task, patch, { updatedAt: now() })
      if (!task.requiresPublishing) Object.assign(task, { publicationStatus: 'not_applicable', plannedPublishDate: null, publishedDate: null, postUrl: null })
      saveTask(task); write(res, 200, { task }); return
    }
    const reportMatch = /^\/api\/tasks\/([^/]+)\/report$/.exec(path)
    if (req.method === 'PATCH' && reportMatch) {
      const user = requireUser(req), task = taskById(reportMatch[1]); ensureTaskAccess(user, task)
      if (user.role === 'employee' && !['todo', 'in_progress', 'needs_revision'].includes(task.status)) fail(400, 'Công việc này không thể báo cáo ở trạng thái hiện tại.')
      const input = await body(req), progress = Number(input.progressPercent)
      if (Object.keys(input).some(key => !['progressPercent', 'completionNote', 'publicationStatus', 'publishedDate', 'postUrl', 'submit'].includes(key))) fail(403, 'Báo cáo chứa trường bạn không được phép thay đổi.')
      if (!Number.isInteger(progress) || progress < 0 || progress > 100) fail(400, 'Tiến độ phải là số nguyên từ 0 đến 100.')
      if (input.submit !== true && input.submit !== false) fail(400, 'Thao tác báo cáo không hợp lệ.')
      const pub = publication(input, task.requiresPublishing, task.plannedPublishDate, task)
      Object.assign(task, pub, { completionNote: text(input.completionNote, 5000), progressPercent: input.submit ? 100 : progress, status: input.submit ? 'waiting_review' : progress > 0 ? 'in_progress' : 'todo', submittedAt: input.submit ? now() : task.submittedAt, updatedAt: now() })
      saveTask(task); write(res, 200, { task }); return
    }
    const reviewMatch = /^\/api\/tasks\/([^/]+)\/review$/.exec(path)
    if (req.method === 'PATCH' && reviewMatch) {
      requireManager(req)
      const task = taskById(reviewMatch[1]); if (!task) fail(404, 'Không tìm thấy công việc.')
      const input = await body(req), status = input.status
      if (!['done', 'needs_revision', 'cancelled'].includes(status)) fail(400, 'Trạng thái duyệt không hợp lệ.')
      if (status !== 'cancelled' && task.status !== 'waiting_review') fail(400, 'Chỉ có thể duyệt công việc đang chờ duyệt.')
      if (task.status === 'cancelled' || task.status === 'done') fail(400, 'Công việc đã kết thúc.')
      Object.assign(task, { status, updatedAt: now(), progressPercent: status === 'done' ? 100 : status === 'needs_revision' ? Math.min(task.progressPercent, 90) : task.progressPercent, completedAt: status === 'done' ? now() : null, completedDate: status === 'done' ? todayVN() : null })
      saveTask(task); write(res, 200, { task }); return
    }
    write(res, 404, { error: 'Không tìm thấy API.' })
  } catch (error) {
    const status = error.status || (error.code === 'SQLITE_CONSTRAINT_UNIQUE' ? 409 : 500)
    if (status === 500) console.error(error)
    write(res, status, { error: status === 500 ? 'Có lỗi máy chủ. Vui lòng thử lại.' : status === 409 ? 'Email này đã tồn tại.' : error.message })
  }
})

const port = Number(process.env.PORT || 8787)
server.listen(port, '127.0.0.1', () => console.log(`API sẵn sàng tại http://127.0.0.1:${port}`))
