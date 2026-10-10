import { describe, expect, it } from 'vitest'
import { calculateKpi } from './kpi'
import { deadlineAlert, deadlineState, emptyContribution, periodAt, taskStatus, validLink } from './tasks'
import type { MarketingTask } from '../types'
import { emptyContentInfo, emptyReview } from './content'
const deadline = '2026-10-09T05:00:00.000Z'
const base: MarketingTask = { sku:'vuatoi.0001', skuNumber:1, contentInfo:emptyContentInfo(), scriptReview:emptyReview(), mediaReview:emptyReview(), id: 'one', title: 'Video', description: '', taskType: 'video', referenceUrl: '', assigneeUids: ['content', 'media'], submittedUids: [], assignments: { content: { fullName: 'Content', workRole: 'content' }, media: { fullName: 'Media', workRole: 'media' } }, contributions: { content: emptyContribution(), media: emptyContribution() }, createdByUid: 'admin', createdByName: 'Admin', status: 'todo', deadlineAt: deadline, periodKey: '2026-10', requiresPublishing: false, publicationStatus: 'not_applicable', plannedPublishDate: null, publishedDate: null, postUrl: null, createdAt: '2026-10-08T05:00:00.000Z', updatedAt: '', completedAt: null }
const task = (changes: Partial<MarketingTask> = {}): MarketingTask => ({ ...base, ...changes })
const submitted = (at: string) => ({ ...emptyContribution(), title: 'Tiêu đề', scriptUrl: 'https://example.com/script', mediaUrl: 'https://example.com/media', status: 'submitted' as const, submittedAt: at })
describe('Deadline theo giờ và task nhiều người', () => {
  it('chỉ nhắc từ đúng 30 phút, báo trễ sau deadline', () => {
    expect(deadlineState(base, Date.parse(deadline) - 1_800_001)).toBe('normal')
    expect(deadlineAlert(base, Date.parse(deadline) - 1_800_000)).toBe('soon')
    expect(deadlineState(base, Date.parse(deadline))).toBe('soon')
    expect(deadlineAlert(base, Date.parse(deadline) + 1)).toBe('late')
  })
  it('một người nộp chưa chuyển task sang chờ duyệt, người đó không bị nhắc nữa', () => {
    const t = task({ contributions: { content: submitted(deadline), media: emptyContribution() } })
    expect(taskStatus(t)).toBe('in_progress')
    expect(deadlineAlert(t, Date.parse(deadline) + 1, 'content')).toBeNull()
    expect(deadlineAlert(t, Date.parse(deadline) + 1, 'media')).toBe('late')
    expect(deadlineAlert(t, Date.parse(deadline) + 1)).toBe('late')
  })
  it('đủ phần việc thì chờ duyệt và ngừng nhắc', () => {
    const t = task({ contributions: { content: submitted(deadline), media: submitted(deadline) } })
    expect(taskStatus(t)).toBe('waiting_review')
    expect(deadlineAlert(t, Date.parse(deadline) + 1)).toBeNull()
  })
  it('nộp sau hạn được đánh dấu trễ dù đang chờ duyệt', () => {
    expect(deadlineState(task({ contributions: { content: submitted(deadline), media: submitted('2026-10-09T05:01:00Z') } }))).toBe('late')
  })
  it('không tính chậm vì ADMIN duyệt sau giờ nộp', () => {
    const t = task({ status: 'done', completedAt: '2026-10-10T05:00:00Z', contributions: { content: submitted(deadline), media: submitted(deadline) } })
    expect(calculateKpi([t], '2026-10').onTime).toBe(1)
  })
  it('hủy không có cảnh báo và không tính KPI', () => {
    const t = task({ status: 'cancelled' })
    expect(deadlineAlert(t, Date.parse(deadline) + 1)).toBeNull()
    expect(calculateKpi([t], '2026-10').total).toBe(0)
  })
  it('kỳ theo múi giờ Việt Nam ở ranh giới tháng', () => {
    expect(periodAt('2026-10-31T18:00:00Z')).toBe('2026-11')
  })
  it('chặn đường dẫn có thể chạy script', () => {
    expect(validLink('javascript:alert(1)')).toBe(false)
    expect(validLink('https://drive.google.com/file/123')).toBe(true)
  })
})

