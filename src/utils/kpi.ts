import type { MarketingTask } from '../types'
import { deadlineState, submissionTime, taskStatus } from './tasks'
export function calculateKpi(tasks: MarketingTask[], period: string, now = Date.now()) {
  const relevant = tasks.filter(t => t.periodKey === period && t.status !== 'cancelled')
  return {
    total: relevant.length,
    done: relevant.filter(t => t.status === 'done').length,
    inProgress: relevant.filter(t => ['in_progress', 'needs_revision'].includes(taskStatus(t))).length,
    waitingReview: relevant.filter(t => taskStatus(t) === 'waiting_review').length,
    overdue: relevant.filter(t => deadlineState(t, now) === 'late').length,
    onTime: relevant.filter(t => t.status === 'done' && (submissionTime(t) ?? Date.parse(t.completedAt || '')) <= Date.parse(t.deadlineAt)).length,
    published: relevant.filter(t => t.publicationStatus === 'published').length,
  }
}
