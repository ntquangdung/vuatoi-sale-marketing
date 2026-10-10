import type { Contribution, MarketingTask, TaskStatus } from '../types'
export const emptyContribution = (): Contribution => ({ title: '', scriptUrl: '', mediaUrl: '', note: '', status: 'pending', submittedAt: null })
export function taskStatus(task: MarketingTask): TaskStatus {
  if (['done', 'cancelled'].includes(task.status)) return task.status
  if (task.assigneeUids.length && task.assigneeUids.every(uid => task.contributions[uid]?.status === 'submitted')) return 'waiting_review'
  if (task.status === 'needs_revision') return 'needs_revision'
  if (Object.values(task.contributions).some(c => c.status !== 'pending')) return 'in_progress'
  return 'todo'
}
export function submissionTime(task: MarketingTask): number | null {
  if (!task.assigneeUids.length || !task.assigneeUids.every(uid => task.contributions[uid]?.submittedAt)) return null
  return Math.max(...task.assigneeUids.map(uid => Date.parse(task.contributions[uid].submittedAt!)))
}
export function deadlineState(task: MarketingTask, now = Date.now()): 'late' | 'soon' | 'normal' | 'finished' {
  if (task.status === 'cancelled') return 'finished'
  const submitted = submissionTime(task)
  if (submitted !== null) return submitted > Date.parse(task.deadlineAt) ? 'late' : 'finished'
  if (task.status === 'done') return 'finished'
  const remaining = Date.parse(task.deadlineAt) - now
  return remaining < 0 ? 'late' : remaining <= 30 * 60_000 ? 'soon' : 'normal'
}
export function deadlineAlert(task: MarketingTask, now: number, uid?: string): 'late' | 'soon' | null {
  if (['done', 'cancelled', 'waiting_review'].includes(taskStatus(task))) return null
  if (uid && (!task.assigneeUids.includes(uid) || task.contributions[uid]?.status === 'submitted')) return null
  const state = deadlineState(task, now)
  return state === 'late' || state === 'soon' ? state : null
}
export function remainingLabel(task: MarketingTask, now = Date.now()): string {
  const submitted = submissionTime(task)
  if (submitted !== null) return submitted > Date.parse(task.deadlineAt) ? 'Nộp trễ hạn' : 'Đã nộp đúng hạn'
  if (task.status === 'cancelled') return 'Đã hủy'
  if (task.status === 'done') return 'Đã hoàn thành'
  const minutes = Math.ceil(Math.abs(Date.parse(task.deadlineAt) - now) / 60_000)
  const duration = minutes >= 60 ? `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút` : `${minutes} phút`
  return Date.parse(task.deadlineAt) < now ? `Trễ ${duration}` : `Còn ${duration}`
}
export function periodAt(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit' }).format(new Date(iso))
}
export function validLink(value: string): boolean {
  if (!value) return true
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !!url.hostname } catch { return false }
}
