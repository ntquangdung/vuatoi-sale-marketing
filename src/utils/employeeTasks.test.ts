import { describe, expect, it } from 'vitest'
import { employeeState, employeeTaskPool, employeeUrgency, needsEmployeeAction } from './employeeTasks'
import { emptyContentInfo, emptyReview, stageSignature } from './content'
import { emptyContribution } from './tasks'
import type { MarketingTask } from '../types'

function task(changes: Partial<MarketingTask> = {}): MarketingTask {
  return { id: 'one', title: 'Video', description: '', taskType: 'video', referenceUrl: '', sku: 'vuatoi.0001', skuNumber: 1, contentInfo: emptyContentInfo(), scriptReview: emptyReview(), mediaReview: emptyReview(), assigneeUids: ['content', 'media'], submittedUids: [], assignments: { content: { fullName: 'Content', workRole: 'content' }, media: { fullName: 'Media', workRole: 'media' } }, contributions: { content: emptyContribution(), media: emptyContribution() }, createdByUid: 'admin', createdByName: 'Admin', status: 'todo', deadlineAt: '2026-10-10T05:00:00Z', periodKey: '2026-10', requiresPublishing: false, publicationStatus: 'not_applicable', plannedPublishDate: null, publishedDate: null, postUrl: null, createdAt: '', updatedAt: '', completedAt: null, ...changes }
}
describe('Danh sách phần việc cá nhân', () => {
  it('người đã nộp không bị hiển thị cần làm hoặc trễ vì đồng đội chưa nộp', () => {
    const value = task(); value.contributions.content = { ...emptyContribution(), status: 'submitted', submittedAt: '2026-10-10T04:00:00Z' }
    expect(employeeState(value, 'content')).toBe('submitted')
    expect(needsEmployeeAction(value, 'content')).toBe(false)
    expect(employeeUrgency(value, 'content', Date.parse('2026-10-10T06:00:00Z'))).toBeNull()
    expect(employeeUrgency(value, 'media', Date.parse('2026-10-10T06:00:00Z'))).toBe('late')
  })
  it('chỉ phần việc được yêu cầu sửa mới hiện cần chỉnh sửa', () => {
    const value = task(); value.contributions.content.status = 'working'; value.scriptReview.status = 'needs_revision'; value.scriptReview.signature = stageSignature(value, 'script')
    expect(employeeState(value, 'content')).toBe('revision')
    expect(employeeState(value, 'media')).toBe('todo')
  })
  it('task hoàn thành hoặc bị hủy không còn nhắc nộp kết quả', () => {
    for (const status of ['done', 'cancelled'] as const) {
      const value = task({ status })
      expect(employeeState(value, 'content')).toBe(status)
      expect(employeeUrgency(value, 'content', Date.parse('2026-10-11T00:00:00Z'))).toBeNull()
    }
  })
  it('nhận đúng mốc còn 30 phút và quá hạn', () => {
    const value = task(), deadline = Date.parse(value.deadlineAt)
    expect(employeeUrgency(value, 'media', deadline - 1_800_001)).toBeNull()
    expect(employeeUrgency(value, 'media', deadline - 1_800_000)).toBe('soon')
    expect(employeeUrgency(value, 'media', deadline)).toBe('soon')
    expect(employeeUrgency(value, 'media', deadline + 1)).toBe('late')
  })
  it('gộp việc đang mở từ tháng trước, loại trùng và loại task không được giao', () => {
    const old = task({ id: 'old', periodKey: '2026-09', deadlineAt: '2026-09-30T05:00:00Z' })
    const fresh = task({ title: 'Tiêu đề mới' })
    const hidden = task({ id: 'hidden', assigneeUids: ['media'] })
    const result = employeeTaskPool([old, task(), hidden], [fresh], 'content')
    expect(result.map(value => value.id)).toEqual(['old', 'one'])
    expect(result[1].title).toBe('Tiêu đề mới')
    expect(employeeState(hidden, 'content')).toBeNull()
  })
})
