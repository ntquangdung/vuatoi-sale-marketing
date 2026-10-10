import type { MarketingTask, TaskInput } from '../types'

export const MAX_COPIES = 50
export function validateCopyCount(count: number) {
  if (!Number.isInteger(count) || count < 1 || count > MAX_COPIES) throw new Error(`Chọn từ 1 đến ${MAX_COPIES} bản mới.`)
}
export function copyTaskInput(task: MarketingTask, deadlineAt: string): TaskInput {
  return {
    title: task.title, description: task.description, taskType: task.taskType, referenceUrl: task.referenceUrl,
    contentInfo: { ...task.contentInfo, ageGroups: [...task.contentInfo.ageGroups], sourceUrl: '', sourceStatus: 'not_started' },
    assignees: task.assigneeUids.map(uid => ({ uid, workRole: task.assignments[uid].workRole })),
    deadlineAt, requiresPublishing: task.requiresPublishing,
  }
}
