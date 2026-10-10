import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { api } from '../lib/data'
import type { MarketingTask } from '../types'
import { Modal } from './TaskUi'

export function DeleteTaskDialog({ task, close, deleted }: { task: MarketingTask; close: () => void; deleted: (id: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function confirm() {
    if (busy) return
    setBusy(true); setError('')
    try {
      const { deletedId } = await api.deleteTask(task.id)
      deleted(deletedId)
    } catch (e) {
      setError((e as Error).message); setBusy(false)
    }
  }
  return <Modal title="Xóa công việc?" compact close={() => { if (!busy) close() }}>
    <div className="delete-task-confirmation">
      <span className="delete-task-icon" aria-hidden="true"><Trash2 size={24} /></span>
      <div className="delete-task-summary"><span>{task.sku || 'Chưa có SKU'}</span><h3>{task.title}</h3><p>{Object.values(task.assignments).map(a => a.fullName).join(', ')}</p></div>
      <p>Công việc và các kết quả đã nộp trong task sẽ bị xóa vĩnh viễn. Thao tác này không thể hoàn tác.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><button autoFocus className="button soft" disabled={busy} onClick={close}>Giữ lại</button><button className="button danger" disabled={busy} onClick={() => void confirm()}><Trash2 size={16} />{busy ? 'Đang xóa…' : 'Xóa vĩnh viễn'}</button></div>
    </div>
  </Modal>
}
