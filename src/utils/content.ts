import type { ContentInfo, MarketingTask, ReviewStage, StageReview } from '../types'

export const ageOptions = ['Dưới 18', '18–24', '25–34', '35–44', '45–54', '55+']
export const sourceLabels = { not_started: 'Chưa quay', shooting: 'Đang quay', recorded: 'Đã quay' }
export const reviewLabels = { not_applicable: 'Không áp dụng', not_submitted: 'Chưa nộp', pending: 'Chờ duyệt', approved: 'Đã duyệt', needs_revision: 'Cần sửa' }
export const emptyContentInfo = (): ContentInfo => ({ pageName: '', videoType: '', contentLine: '', ageGroups: [], audience: '', campaign: '', sourceUrl: '', sourceStatus: 'not_started' })
export const emptyReview = (): StageReview => ({ status: 'pending', byUid: '', byName: '', signature: '', reviewedAt: null })
export function skuFor(number: number) {
  if (!Number.isSafeInteger(number) || number < 1) throw new Error('Số SKU không hợp lệ.')
  return `vuatoi.${String(number).padStart(4, '0')}`
}
export const stageMembers = (task: MarketingTask, stage: ReviewStage) => task.assigneeUids.filter(uid => task.assignments[uid]?.workRole === (stage === 'script' ? 'content' : 'media'))
export function stageSignature(task: MarketingTask, stage: ReviewStage) {
  return JSON.stringify(stageMembers(task, stage).sort().map(uid => {
    const c = task.contributions[uid]
    return stage === 'script' ? [uid, c?.title || '', c?.scriptUrl || '', c?.status, c?.submittedAt] : [uid, c?.mediaUrl || '', c?.status, c?.submittedAt]
  }))
}
export function stageState(task: MarketingTask, stage: ReviewStage): keyof typeof reviewLabels {
  const members = stageMembers(task, stage), review = stage === 'script' ? task.scriptReview : task.mediaReview
  if (!members.length) return 'not_applicable'
  if (task.status === 'done' && !review.reviewedAt) return 'approved'
  const matches = review.signature === stageSignature(task, stage)
  if (matches && review.status === 'needs_revision') return 'needs_revision'
  if (members.some(uid => task.contributions[uid]?.status !== 'submitted')) return 'not_submitted'
  return matches ? review.status : 'pending'
}
export function contentTitles(task: MarketingTask) {
  return stageMembers(task, 'script').map(uid => task.contributions[uid]?.title).filter(Boolean).join(' / ') || task.title
}
