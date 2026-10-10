import { useState, type FormEvent } from 'react'
import type { PublicationInput } from '../lib/data'
import { todayVN } from '../lib/date'
import type { MarketingTask, PublicationStatus } from '../types'

export function PublicationEditor({ task, manager = false, save }: { task: MarketingTask; manager?: boolean; save: (data: PublicationInput) => Promise<void> }) {
  const [data, setData] = useState<PublicationInput>({ requiresPublishing: task.requiresPublishing, plannedPublishDate: task.plannedPublishDate, publicationStatus: task.publicationStatus === 'not_applicable' ? 'not_scheduled' : task.publicationStatus, publishedDate: task.publishedDate, postUrl: task.postUrl })
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try { await save(data) } catch (error) { setError((error as Error).message) } finally { setBusy(false) }
  }
  return <form className="form-stack" onSubmit={submit}>
    <fieldset className="plain-fieldset form-stack" disabled={busy}>
      {manager && <label className="toggle-line"><input type="checkbox" checked={data.requiresPublishing} onChange={e => setData({ ...data, requiresPublishing: e.target.checked })} />Cần đăng bài / video</label>}
      {data.requiresPublishing && <>
        <label>Trạng thái đăng bài / video<select required value={['scheduled', 'published'].includes(data.publicationStatus) ? data.publicationStatus : ''} onChange={e => setData({ ...data, publicationStatus: e.target.value as PublicationStatus, publishedDate: e.target.value === 'published' ? data.publishedDate || todayVN() : null })}>
          <option value="" disabled>Chọn trạng thái</option><option value="scheduled">Đã lên lịch</option><option value="published">Đã đăng</option>
        </select></label>
        {data.publicationStatus === 'scheduled' && <label>Ngày đã lên lịch<input type="date" required value={data.plannedPublishDate || ''} onChange={e => setData({ ...data, plannedPublishDate: e.target.value || null })} /></label>}
        {data.publicationStatus === 'published' && <>
          <label>Ngày đã đăng<input type="date" required value={data.publishedDate || ''} onChange={e => setData({ ...data, publishedDate: e.target.value || null })} /></label>
          <label>Link bài đăng / video<input type="url" maxLength={2000} required value={data.postUrl || ''} placeholder="https://…" onChange={e => setData({ ...data, postUrl: e.target.value || null })} /></label>
        </>}
      </>}
    </fieldset>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><button disabled={busy} className="button primary" type="submit">{busy ? 'Đang lưu…' : 'Lưu thông tin đăng'}</button></div>
  </form>
}
