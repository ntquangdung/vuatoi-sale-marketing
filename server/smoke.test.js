import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'

async function freePort() { const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port }

test('API local bảo vệ vai trò và dữ liệu nhân viên', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'marketing-api-'))
  const port = await freePort()
  const child = spawn(process.execPath, ['server/index.js'], { cwd: process.cwd(), env: { ...process.env, DATA_DIR: dir, PORT: String(port), NODE_NO_WARNINGS: '1' }, stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  child.stdout.on('data', chunk => { output += chunk })
  child.stderr.on('data', chunk => { output += chunk })
  const root = `http://127.0.0.1:${port}/api`
  const call = async (path, method = 'GET', data, cookie = '') => {
    const response = await fetch(root + path, { method, headers: { ...(data ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: data ? JSON.stringify(data) : undefined })
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] || '' }
  }
  try {
    let ready = false, lastError = ''
    for (let i = 0; i < 50; i++) { try { ready = (await call('/bootstrap-status')).status === 200; if (ready) break } catch (error) { lastError = String(error); await new Promise(resolve => setTimeout(resolve, 50)) } }
    assert.equal(ready, true, `${output}\n${lastError}`)
    assert.equal((await call('/bootstrap', 'POST', { fullName: 'Admin', email: 'admin@test.local', password: 'TestPassword123' })).status, 201)
    assert.equal((await call('/bootstrap', 'POST', { fullName: 'Admin 2', email: 'admin2@test.local', password: 'TestPassword123' })).status, 403)
    const adminLogin = await call('/login', 'POST', { email: 'admin@test.local', password: 'TestPassword123' })
    assert.equal(adminLogin.status, 200)
    const admin = adminLogin.cookie
    const employeeInput = name => ({ fullName: name, email: `${name.toLowerCase()}@test.local`, password: 'TestPassword123', role: 'employee', active: true })
    const alice = await call('/users', 'POST', employeeInput('Alice'), admin)
    const bob = await call('/users', 'POST', employeeInput('Bob'), admin)
    assert.equal(alice.status, 201); assert.equal(bob.status, 201)
    const manager = await call('/users', 'POST', { fullName: 'Manager', email: 'manager@test.local', password: 'TestPassword123', role: 'manager', active: true }, admin)
    assert.equal(manager.status, 201)
    const managerLogin = await call('/login', 'POST', { email: 'manager@test.local', password: 'TestPassword123' })
    assert.equal((await call('/users', 'GET', undefined, managerLogin.cookie)).status, 200)
    assert.equal((await call(`/users/${alice.data.user.uid}`, 'PATCH', { role: 'admin' }, managerLogin.cookie)).status, 403)
    const dueDate = '2026-10-20'
    const taskInput = assigneeUid => ({ title: 'Viết nội dung', description: '', taskType: 'content', assigneeUid, priority: 'normal', dueDate, requiresPublishing: false, plannedPublishDate: null })
    const created = await call('/tasks', 'POST', taskInput(alice.data.user.uid), admin)
    assert.equal(created.status, 201)
    assert.equal((await call('/dashboard?period=2026-10', 'GET', undefined, admin)).data.tasks.length, 1)
    const aliceLogin = await call('/login', 'POST', { email: 'alice@test.local', password: 'TestPassword123' })
    const aliceCookie = aliceLogin.cookie
    assert.equal((await call('/tasks?period=2026-10', 'GET', undefined, aliceCookie)).data.tasks.length, 1)
    assert.equal((await call('/users', 'GET', undefined, aliceCookie)).status, 403)
    assert.equal((await call(`/tasks/${created.data.task.id}`, 'PATCH', { ...taskInput(bob.data.user.uid) }, aliceCookie)).status, 403)
    assert.equal((await call(`/tasks/${created.data.task.id}/review`, 'PATCH', { status: 'done' }, aliceCookie)).status, 403)
    assert.equal((await call(`/tasks/${created.data.task.id}/report`, 'PATCH', { progressPercent: 50, completionNote: '', publicationStatus: 'not_applicable', publishedDate: null, postUrl: null, submit: false, dueDate: '2030-01-01' }, aliceCookie)).status, 403)
    assert.equal((await call(`/tasks/${created.data.task.id}/report`, 'PATCH', { progressPercent: 100, completionNote: 'Xong', publicationStatus: 'not_applicable', publishedDate: null, postUrl: null, submit: true }, aliceCookie)).status, 200)
    assert.equal((await call(`/tasks/${created.data.task.id}/review`, 'PATCH', { status: 'done' }, admin)).status, 200)
    const bobLogin = await call('/login', 'POST', { email: 'bob@test.local', password: 'TestPassword123' })
    assert.equal((await call(`/tasks/${created.data.task.id}`, 'GET', undefined, bobLogin.cookie)).status, 403)
    assert.equal((await call('/tasks?period=2026-10', 'GET', undefined, bobLogin.cookie)).data.tasks.length, 0)
    const managerTask = await call('/tasks', 'POST', { ...taskInput(bob.data.user.uid), title: 'Video mới', taskType: 'video', requiresPublishing: true, plannedPublishDate: '2026-10-22' }, managerLogin.cookie)
    assert.equal(managerTask.status, 201)
    assert.equal((await call(`/tasks/${managerTask.data.task.id}/report`, 'PATCH', { progressPercent: 50, completionNote: '', publicationStatus: 'published', publishedDate: '2026-10-09', postUrl: null, submit: false }, bobLogin.cookie)).status, 400)
    assert.equal((await call(`/users/${alice.data.user.uid}`, 'PATCH', { active: false }, admin)).status, 200)
    assert.equal((await call('/tasks?period=2026-10', 'GET', undefined, aliceCookie)).status, 401)
    assert.equal((await call('/login', 'POST', { email: 'alice@test.local', password: 'TestPassword123' })).status, 403)
  } finally { child.kill(); await new Promise(resolve => child.once('exit', resolve)); rmSync(dir, { recursive: true, force: true }) }
})
