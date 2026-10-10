import type { MarketingTask } from '../types'
import { stageState } from './content'

export type EmployeeState = 'todo' | 'working' | 'revision' | 'submitted' | 'done' | 'cancelled'
export const employeeStateLabel: Record<EmployeeState, string> = {
  todo: 'Cần làm', working: 'Đang làm', revision: 'Cần chỉnh sửa', submitted: 'Đã nộp', done: 'Hoàn thành', cancelled: 'Đã hủy',
}
export function employeeState(task: MarketingTask, uid: string): EmployeeState | null {
  if (!task.assigneeUids.includes(uid)) return null
  if (task.status === 'cancelled' || task.status === 'done') return task.status
  const own = task.contributions[uid]
  if (own?.status === 'submitted') return 'submitted'
  const role = task.assignments[uid]?.workRole
  if (task.status === 'needs_revision' || (role === 'content' && stageState(task, 'script') === 'needs_revision') || (role === 'media' && stageState(task, 'media') === 'needs_revision')) return 'revision'
  return own?.status === 'working' ? 'working' : 'todo'
}
export function needsEmployeeAction(task: MarketingTask, uid: string): boolean {
  const state = employeeState(task, uid)
  return state === 'todo' || state === 'working' || state === 'revision'
}
export function employeeUrgency(task: MarketingTask, uid: string, now: number): 'late' | 'soon' | null {
  if (!needsEmployeeAction(task, uid)) return null
  const remaining = Date.parse(task.deadlineAt) - now
  return remaining < 0 ? 'late' : remaining <= 30 * 60_000 ? 'soon' : null
}
export function employeeTaskPool(active: MarketingTask[], month: MarketingTask[], uid: string): MarketingTask[] {
  // Monthly snapshots are current even if an active query still contains an older open version.
  return [...new Map([...active, ...month].map(task => [task.id, task])).values()]
    .filter(task => task.assigneeUids.includes(uid))
    .sort((a, b) => Date.parse(a.deadlineAt) - Date.parse(b.deadlineAt) || a.id.localeCompare(b.id))
}
