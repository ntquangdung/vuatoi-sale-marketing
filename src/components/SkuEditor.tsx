import { useState, type FormEvent } from 'react'
import { normalizeSku } from '../utils/content'
import type { MarketingTask } from '../types'

export function SkuEditor({ task, save, close }: { task: MarketingTask; save: (sku: string) => Promise<void>; close: () => void }) {
  const [sku, setSku] = useState(task.sku)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try { await save(normalizeSku(sku)) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return <form className="form-stack" onSubmit={submit}>
    <div className="sku-preview"><b>{task.sku}</b><span>{task.title}</span></div>
    <label>SKU mới<input autoFocus required maxLength={80} value={sku} disabled={busy} onChange={e => setSku(e.target.value)} placeholder="vuatoi.0011 hoặc vuatoi-video-01" /></label>
    <p className="form-help">Chữ không dấu, số, dấu chấm, gạch ngang hoặc gạch dưới. Mã được lưu bằng chữ thường và phải khác các task hiện có.</p>
    <p className="form-help">SKU tự động vẫn tăng tiếp, không lấp số đã xóa. Nếu đổi thành mã vuatoi lớn hơn số hiện tại, mã tự động tiếp theo sẽ tăng từ số đó.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><button type="button" className="button soft" disabled={busy} onClick={close}>Hủy</button><button className="button primary" disabled={busy || sku.trim() === task.sku}>{busy ? 'Đang lưu…' : 'Lưu SKU'}</button></div>
  </form>
}
