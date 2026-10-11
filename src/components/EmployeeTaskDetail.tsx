import { useState } from 'react'
import { CheckCheck, ChevronDown, Clock3, Send } from 'lucide-react'
import { api } from '../lib/data'
import { formatDateTime } from '../lib/date'
import { emptyContribution } from '../utils/tasks'
import { employeeState, employeeStateLabel, employeeUrgency } from '../utils/employeeTasks'
import { Link, workLabel } from './TaskUi'
import { PublicationEditor } from './PublicationEditor'
import type { MarketingTask, UserProfile } from '../types'

export function EmployeeTaskDetail({ task, user, now, action, readOnly = false }: { task: MarketingTask; user: UserProfile; now: number; action: (fn: () => Promise<unknown>, message: string) => Promise<void>; readOnly?: boolean }) {
  const own = task.contributions[user.uid] || emptyContribution(), ownRole = task.assignments[user.uid]?.workRole || 'other'
  const [report, setReport] = useState({ title: own.title, scriptUrl: own.scriptUrl, sourceUrl: own.sourceUrl, mediaUrl: own.mediaUrl, note: own.note })
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const state = employeeState(task, user.uid), closed = task.status === 'done' || task.status === 'cancelled'
  const urgency = employeeUrgency(task, user.uid, now)
  if (!state) return <p className="form-error">Công việc này chưa được giao cho bạn.</p>
  async function save(submit: boolean) {
    if (busy || readOnly) return
    setBusy(true); setError('')
    try { await action(() => api.report(task.id, { ...report, submit }), submit ? 'Đã nộp phần việc của bạn.' : 'Đã lưu bản nháp.') } catch (error) { setError((error as Error).message) } finally { setBusy(false) }
  }
  const partnerScripts = task.assigneeUids.filter(uid => uid !== user.uid && task.contributions[uid]?.scriptUrl)
  return <div className="employee-detail">
    <div className="employee-detail-meta"><span className="employee-task-sku">{task.sku}</span><span className={`employee-state ${state}`}><i />{employeeStateLabel[state]}</span></div>
    <div className="employee-detail-context"><div><span>Phần việc của bạn</span><b>{workLabel[ownRole]}</b></div><div className={urgency ? `employee-urgency-${urgency}` : ''}><span><Clock3 size={13} />Deadline · giờ Việt Nam</span><b>{formatDateTime(task.deadlineAt)}</b></div></div>
    {(task.description || task.referenceUrl || partnerScripts.length > 0) && <section className="employee-brief"><h3>Yêu cầu & tài liệu</h3>{task.description && <p>{task.description}</p>}<div className="result-links"><Link url={task.referenceUrl}>Tài liệu được giao</Link>{partnerScripts.map(uid => <Link key={uid} url={task.contributions[uid].scriptUrl}>Kịch bản · {task.assignments[uid]?.fullName}</Link>)}</div></section>}
    <section className="employee-submit-section"><div className="employee-section-heading"><h3>Kết quả của tôi</h3>{own.submittedAt && <span><CheckCheck size={14} />Đã nộp {formatDateTime(own.submittedAt)}</span>}</div>
      {state === 'revision' && <p className="employee-revision-note">Phần việc cần chỉnh sửa. Cập nhật kết quả bên dưới và nộp lại để quản lý duyệt.</p>}
      {closed ? <div className="employee-saved-results">{own.title && <b>{own.title}</b>}<div className="result-links"><Link url={own.scriptUrl}>Kịch bản đã nộp</Link><Link url={own.sourceUrl}>Source / footage</Link><Link url={own.mediaUrl}>Media đã edit</Link></div>{own.note && <p>{own.note}</p>}{!own.title && !own.scriptUrl && !own.mediaUrl && !own.sourceUrl && <p className="muted">Chưa có kết quả đã nộp.</p>}</div> : <div className="form-stack employee-report-form">
        <fieldset className="plain-fieldset form-stack" disabled={busy || readOnly}>
          {ownRole !== 'media' && <><label>Caption<input maxLength={180} value={report.title} onChange={event => setReport({ ...report, title: event.target.value })} placeholder="Nhập caption cho nội dung" /></label><label>Link kịch bản<input type="url" maxLength={2000} value={report.scriptUrl} onChange={event => setReport({ ...report, scriptUrl: event.target.value })} placeholder="https://docs.google.com/…" /></label></>}
          {ownRole !== 'content' && <label>Link media đã edit<input type="url" maxLength={2000} value={report.mediaUrl} onChange={event => setReport({ ...report, mediaUrl: event.target.value })} placeholder="https://drive.google.com/…" /></label>}
          <details className="employee-optional-fields" open={!!own.sourceUrl || !!own.note}><summary>Link source & ghi chú <span>Tùy chọn</span><ChevronDown size={15} /></summary><div className="form-stack"><label>Link source / footage<input type="url" maxLength={2000} value={report.sourceUrl} onChange={event => setReport({ ...report, sourceUrl: event.target.value })} placeholder="https://drive.google.com/…" /></label><label>Ghi chú<textarea rows={3} maxLength={5000} value={report.note} onChange={event => setReport({ ...report, note: event.target.value })} placeholder="Thông tin cần trao đổi với quản lý…" /></label></div></details>
        </fieldset>
        {error && <p className="form-error" role="alert">{error}</p>}
        {!readOnly && <div className="employee-report-actions"><small>{ownRole === 'content' ? 'Nộp caption và link kịch bản.' : ownRole === 'media' ? 'Nộp link media đã edit.' : 'Điền kết quả phần việc được giao.'}</small><div>{own.status !== 'submitted' && <button className="button soft" disabled={busy} onClick={() => void save(false)}>Lưu nháp</button>}<button className="button primary" disabled={busy} onClick={() => void save(true)}><Send size={15} />{busy ? 'Đang lưu…' : own.status === 'submitted' ? 'Cập nhật kết quả' : 'Nộp kết quả'}</button></div></div>}
      </div>}
    </section>
    {task.requiresPublishing && task.status !== 'cancelled' && !readOnly && <details className="employee-detail-disclosure"><summary>Đăng bài / video<span>{task.publicationStatus === 'published' ? 'Đã đăng' : task.publicationStatus === 'scheduled' ? 'Đã lên lịch' : 'Chưa cập nhật'}</span><ChevronDown size={16} /></summary><PublicationEditor task={task} save={data => action(() => api.publish(task.id, data), 'Đã cập nhật lịch đăng.')} /></details>}
    <details className="employee-detail-disclosure"><summary>Phối hợp cùng đội ngũ<span>{task.assigneeUids.length} người</span><ChevronDown size={16} /></summary><div className="employee-partners">{task.assigneeUids.map(uid => { const contribution = task.contributions[uid] || emptyContribution(), assignment = task.assignments[uid]; return <article key={uid}><div><b>{assignment?.fullName}{uid === user.uid ? ' (bạn)' : ''}</b><small>{workLabel[assignment?.workRole || 'other']} · {contribution.status === 'submitted' ? 'Đã nộp' : 'Chưa nộp'}</small></div>{contribution.title && <p>{contribution.title}</p>}<div className="result-links"><Link url={contribution.scriptUrl}>Kịch bản</Link><Link url={contribution.sourceUrl}>Source</Link><Link url={contribution.mediaUrl}>Media</Link></div></article> })}</div></details>
  </div>
}
