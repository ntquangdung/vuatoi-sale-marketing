import { useState, type FormEvent } from 'react'
import { Copy, X } from 'lucide-react'
import { dateTimeFromVN, dateTimeInputVN } from '../lib/date'
import { MAX_COPIES } from '../utils/duplicate'
import { workLabel } from './TaskUi'
import type { MarketingTask } from '../types'

export function DuplicateTasks({ tasks, close, save }: { tasks: MarketingTask[]; close: () => void; save: (task: MarketingTask, count: number, deadlineAt: string) => Promise<void> }) {
  const [sourceId, setSourceId] = useState(''), [count, setCount] = useState(10), [deadlineAt, setDeadlineAt] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const source = tasks.find(task => task.id === sourceId)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!source || busy) return
    setBusy(true); setError('')
    try { await save(source, count, deadlineAt) } catch (error) { setError((error as Error).message) } finally { setBusy(false) }
  }
  return <form className="duplicate-panel" aria-label="Sao chép công việc theo SKU" onSubmit={submit}>
    <div className="duplicate-heading"><span className="duplicate-icon"><Copy size={19} /></span><div><h3>Sao chép SKU</h3><p>Chọn một công việc mẫu để tạo nhanh nhiều bản với SKU riêng.</p></div><button type="button" className="icon-button" disabled={busy} aria-label="Đóng sao chép SKU" onClick={close}><X size={18} /></button></div>
    <fieldset disabled={busy} className="plain-fieldset duplicate-fields">
      <label>Công việc mẫu<select required value={sourceId} onChange={e => { const task = tasks.find(t => t.id === e.target.value); setSourceId(e.target.value); setDeadlineAt(task && Date.parse(task.deadlineAt) > Date.now() ? task.deadlineAt : '') }}><option value="">Chọn SKU cần sao chép</option>{tasks.map(task => <option key={task.id} value={task.id}>{task.sku} · {task.title}</option>)}</select></label>
      <label>Số bản mới<input type="number" required min={1} max={MAX_COPIES} step={1} value={count || ''} onChange={e => setCount(Number(e.target.value))} /></label>
      <label>Deadline cho các bản mới<input type="datetime-local" required value={dateTimeInputVN(deadlineAt)} onChange={e => setDeadlineAt(dateTimeFromVN(e.target.value))} /></label>
    </fieldset>
    {source && <div className="duplicate-assignees"><span>Giữ nguyên người được giao</span><div className="grid-chips">{source.assigneeUids.map(uid => <span className="grid-chip" key={uid}>{source.assignments[uid].fullName} · {workLabel[source.assignments[uid].workRole]}</span>)}</div></div>}
    <div className="duplicate-actions"><p>Giữ nội dung và phân loại của mẫu. Các bản mới bắt đầu ở trạng thái Cần làm, chưa có kết quả hoặc lịch đăng. Giờ Việt Nam (GMT+7).</p><button className="button primary" disabled={busy || !source} type="submit"><Copy size={16} />{busy ? 'Đang tạo các bản mới…' : `Tạo ${count || 0} bản mới`}</button></div>
    {error && <p className="form-error" role="alert">{error}</p>}
  </form>
}
