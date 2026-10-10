import { useState, type FormEvent } from 'react'
import { dateTimeFromVN, dateTimeInputVN } from '../lib/date'
import { typeLabel } from '../lib/labels'
import { workLabel } from './TaskUi'
import { ContentInfoFields } from './ContentInfoFields'
import { emptyContentInfo } from '../utils/content'
import type { MarketingTask, TaskInput, TaskType, UserProfile, WorkRole } from '../types'
const types: TaskType[] = ['video', 'content', 'seo', 'design', 'other']
export function TaskForm({ existing, users, save }: { existing?: MarketingTask; users: UserProfile[]; save: (data: TaskInput) => Promise<void> }) {
  const [data, setData] = useState<TaskInput>(existing ? { title: existing.title, description: existing.description, taskType: existing.taskType, referenceUrl: existing.referenceUrl, contentInfo:existing.contentInfo, assignees: existing.assigneeUids.map(uid => ({ uid, workRole: existing.assignments[uid].workRole })), deadlineAt: existing.deadlineAt, requiresPublishing: existing.requiresPublishing } : { title: '', description: '', taskType: 'video', referenceUrl: '', contentInfo:{...emptyContentInfo(),pageName:'VUA TỎI'}, assignees: [], deadlineAt: '', requiresPublishing: false })
  const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const employees = users.filter(u => u.role === 'employee' && u.active)
  function field<K extends keyof TaskInput>(key: K, value: TaskInput[K]) { setData(d => ({ ...d, [key]: value })) }
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); setError(''); try { await save(data) } catch (e) { setError((e as Error).message) } finally { setBusy(false) } }
  return <form className="form-stack" onSubmit={submit}>
    <div className="sku-preview"><b>{existing?.sku || 'SKU tự động'}</b><span>{existing?.sku ? 'Mã cố định của công việc' : 'Mã vuatoi.0001, vuatoi.0002… được cấp khi tạo'}</span></div>
    <label>Tên công việc<input autoFocus required maxLength={180} value={data.title} onChange={e => field('title', e.target.value)} placeholder="Ví dụ: Video giới thiệu tỏi Lý Sơn" /></label>
    <label>Mô tả / yêu cầu<textarea rows={3} maxLength={5000} value={data.description} onChange={e => field('description', e.target.value)} placeholder="Mục tiêu và yêu cầu cần hoàn thành…" /></label>
    <label>Link tài liệu giao cho nhân viên<input type="url" maxLength={2000} value={data.referenceUrl} onChange={e => field('referenceUrl', e.target.value)} placeholder="https://docs.google.com/…" /></label>
    <details className="content-form-section" open><summary>Thông tin bảng nội dung</summary><div className="form-stack"><ContentInfoFields value={data.contentInfo} change={value => field('contentInfo',value)} /></div></details>
    <div className="form-grid"><label>Loại công việc<select value={data.taskType} onChange={e => field('taskType', e.target.value as TaskType)}>{types.map(t => <option value={t} key={t}>{typeLabel[t]}</option>)}</select></label><label>Deadline · ngày và giờ<input type="datetime-local" required value={dateTimeInputVN(data.deadlineAt)} onChange={e => field('deadlineAt', dateTimeFromVN(e.target.value))} /></label></div>
    <p className="form-help">Giờ Việt Nam (GMT+7). Nhắc trước 30 phút; quá deadline sẽ báo trễ.</p>
    <div><h3 className="form-section-title">Giao phần việc · {data.assignees.length}/8 người</h3><p className="form-help">Chọn nhiều nhân viên và vai trò cho từng người.</p>
    {employees.length ? <div className="assignment-picker">{employees.map(u => { const selected = data.assignees.find(a => a.uid === u.uid); return <div className={`assignment-option ${selected ? 'selected' : ''}`} key={u.uid}><label><input type="checkbox" checked={!!selected} disabled={!selected && data.assignees.length >= 8} onChange={e => field('assignees', e.target.checked ? [...data.assignees, { uid: u.uid, workRole: 'content' }] : data.assignees.filter(a => a.uid !== u.uid))} /><span className="avatar small">{u.fullName[0]}</span><span><b>{u.fullName}</b><small>{u.email}</small></span></label>{selected && <select aria-label={`Phần việc của ${u.fullName}`} value={selected.workRole} onChange={e => field('assignees', data.assignees.map(a => a.uid === u.uid ? { ...a, workRole: e.target.value as WorkRole } : a))}>{Object.entries(workLabel).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select>}</div> })}</div> : <p className="form-error">Chưa có nhân viên. Nhân viên cần đăng nhập Google một lần để xuất hiện ở đây.</p>}</div>
    <label className="toggle-line"><input type="checkbox" checked={data.requiresPublishing} onChange={e => field('requiresPublishing', e.target.checked)} /><span>Cần đăng bài / video</span></label>
    {data.requiresPublishing && <p className="form-help">Nhân viên tự cập nhật ngày lên lịch hoặc ngày đã đăng trong công việc.</p>}
    {error && <p className="form-error">{error}</p>}<div className="form-actions"><button disabled={busy || !data.assignees.length} className="button primary" type="submit">{busy ? 'Đang lưu…' : existing ? 'Lưu thay đổi' : 'Tạo & giao công việc'}</button></div>
  </form>
}
