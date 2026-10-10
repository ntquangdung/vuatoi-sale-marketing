import { describe, expect, it } from 'vitest'
import { copyTaskInput, validateCopyCount } from './duplicate'
import { emptyContentInfo, emptyReview } from './content'
import { emptyContribution } from './tasks'
import { dateTimeFromVN, dateTimeInputVN } from '../lib/date'
import type { MarketingTask } from '../types'

describe('sao chép công việc và ngày giờ Việt Nam', () => {
  it('giữ nội dung, người và vai trò; không sao chép kết quả hay lịch đăng của mẫu', () => {
    const source: MarketingTask = {
      id: 'original', sku: 'vuatoi.0009', skuNumber: 9, title: 'Nội dung mẫu', description: 'Yêu cầu', taskType: 'video', referenceUrl: 'https://example.com/brief',
      contentInfo: { ...emptyContentInfo(), pageName: 'VUA TỎI', ageGroups: ['25–34'], sourceUrl: 'https://example.com/old', sourceStatus: 'recorded' },
      assigneeUids: ['a', 'b'], assignments: { a: { fullName: 'Content', workRole: 'content' }, b: { fullName: 'Media', workRole: 'media' } },
      contributions: { a: { ...emptyContribution(), scriptUrl: 'https://example.com/script', status: 'submitted' }, b: emptyContribution() }, submittedUids: ['a'],
      scriptReview: emptyReview(), mediaReview: emptyReview(), createdByUid: 'admin', createdByName: 'Admin', status: 'done',
      deadlineAt: '2026-10-10T05:00:00Z', periodKey: '2026-10', requiresPublishing: true, publicationStatus: 'published', plannedPublishDate: '2026-10-10', publishedDate: '2026-10-10', postUrl: 'https://example.com/post', createdAt: '', updatedAt: '', completedAt: '',
    }
    const original = structuredClone(source), input = copyTaskInput(source, '2027-01-01T02:00:00.000Z')
    expect(input.title).toBe(source.title)
    expect(input.assignees).toEqual([{ uid: 'a', workRole: 'content' }, { uid: 'b', workRole: 'media' }])
    expect(input.contentInfo).toMatchObject({ pageName: 'VUA TỎI', sourceStatus: 'not_started', sourceUrl: '' })
    expect(input).not.toHaveProperty('sku')
    expect(input).not.toHaveProperty('contributions')
    expect(input).not.toHaveProperty('publicationStatus')
    expect(input.deadlineAt).toBe('2027-01-01T02:00:00.000Z')
    input.contentInfo.ageGroups.push('35–44')
    expect(source).toEqual(original)
  })
  it('chỉ nhận số bản nguyên trong giới hạn', () => {
    for (const count of [1, 10, 50]) expect(() => validateCopyCount(count)).not.toThrow()
    for (const count of [0, -1, 1.5, 51, NaN, Infinity]) expect(() => validateCopyCount(count)).toThrow()
  })
  it('ngày giờ chọn không phụ thuộc múi giờ máy và giữ đúng ngày qua giao tháng', () => {
    expect(dateTimeFromVN('2026-11-01T00:15')).toBe('2026-10-31T17:15:00.000Z')
    expect(dateTimeInputVN('2026-10-31T17:15:00.000Z')).toBe('2026-11-01T00:15')
    expect(dateTimeFromVN('')).toBe('')
    expect(dateTimeFromVN('2026-02-30T10:00')).toBe('')
    expect(dateTimeInputVN('invalid')).toBe('')
  })
})
