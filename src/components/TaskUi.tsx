import { useEffect, type ReactNode } from 'react'
import { ClipboardList, ExternalLink, X } from 'lucide-react'
import { formatDateTime } from '../lib/date'
import { statusLabel } from '../lib/labels'
import { deadlineState, remainingLabel, taskStatus } from '../utils/tasks'
import type { MarketingTask, WorkRole } from '../types'
export const workLabel: Record<WorkRole, string> = { content: 'Content · Kịch bản', media: 'Media · Edit', other: 'Phần việc khác' }
export function Badge({ task }: { task: MarketingTask }) { const s = taskStatus(task); return <span className={`badge badge-${s}`}><i />{statusLabel[s]}</span> }
export function Loading() { return <div className="state"><span className="spinner" /><p>Đang tải dữ liệu…</p></div> }
export function Empty({ title, text }: { title: string; text: string }) { return <div className="empty"><span className="empty-icon"><ClipboardList size={25} /></span><h3>{title}</h3><p>{text}</p></div> }
export function Link({ url, children }: { url?: string | null; children: ReactNode }) { return url ? <a className="result-link" href={url} target="_blank" rel="noopener noreferrer">{children}<ExternalLink size={13} /></a> : null }
export function Modal({ title, close, children, compact = false }: { title: string; close: () => void; children: ReactNode; compact?: boolean }) {
  useEffect(() => { const old = document.body.style.overflow; document.body.style.overflow = 'hidden'; const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }; document.addEventListener('keydown', handler); return () => { document.body.style.overflow = old; document.removeEventListener('keydown', handler) } }, [close])
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close() }}><section className={`modal ${compact ? '' : 'wide'}`} role="dialog" aria-modal="true" aria-label={title}><div className="modal-head"><h2>{title}</h2><button className="icon-button" aria-label="Đóng" onClick={close}><X size={20} /></button></div><div className="modal-content">{children}</div></section></div>
}
export function Deadline({ task, now }: { task: MarketingTask; now: number }) { return <div className={`deadline deadline-${deadlineState(task, now)}`}><b>{remainingLabel(task, now)}</b><small>{formatDateTime(task.deadlineAt)}</small></div> }
