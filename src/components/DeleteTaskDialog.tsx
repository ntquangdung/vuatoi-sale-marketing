import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { api } from '../lib/data'
import type { MarketingTask } from '../types'
import { Modal } from './TaskUi'

export function DeleteTaskDialog({ tasks, close, deleted }: { tasks: MarketingTask[]; close: () => void; deleted: (ids: string[]) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function confirm() {
    if (busy) return
    setBusy(true); setError('')
    try {
      const { deletedIds } = await api.deleteTasks(tasks.map(task => task.id))
      deleted(deletedIds)
    } catch (e) {
      setError((e as Error).message); setBusy(false)
    }
  }
  return <Modal title={tasks.length > 1 ? `Xóa ${tasks.length} công việc?` : 'Xóa công việc?'} compact close={() => { if (!busy) close() }}>
    <div className="delete-task-confirmation">
      <span className="delete-task-icon" aria-hidden="true"><Trash2 size={24} /></span>
      <div className="delete-task-list">{tasks.map(task => <div className="delete-task-summary" key={task.id}><span>{task.sku || 'Chưa có SKU'}</span><h3>{task.title}</h3>{tasks.length === 1 && <p>{Object.values(task.assignments).map(a => a.fullName).join(', ')}</p>}</div>)}</div>
      <p>{tasks.length > 1 ? `${tasks.length} công việc đã chọn` : 'Công việc'} và các kết quả đã nộp sẽ bị xóa vĩnh viễn. Thao tác này không thể hoàn tác.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><button autoFocus className="button soft" disabled={busy} onClick={close}>Giữ lại</button><button className="button danger" disabled={busy || !tasks.length} onClick={() => void confirm()}><Trash2 size={16} />{busy ? 'Đang xóa…' : `Xóa ${tasks.length} công việc`}</button></div>
    </div>
  </Modal>
}
