export type Role = 'admin' | 'manager' | 'employee'
export type AccountPosition = 'content' | 'media' | 'manager' | 'admin'
export type TaskStatus = 'todo' | 'in_progress' | 'waiting_review' | 'needs_revision' | 'done' | 'cancelled'
export type TaskType = 'video' | 'content' | 'seo' | 'design' | 'other'
export type PublicationStatus = 'not_applicable' | 'not_scheduled' | 'scheduled' | 'published'
export type WorkRole = 'content' | 'media' | 'other'
export type ReviewStage = 'script' | 'media'
export type ReviewStatus = 'pending' | 'approved' | 'needs_revision'
export type SourceStatus = 'not_started' | 'shooting' | 'recorded'
export interface ContentInfo {
  pageName: string; videoType: string; contentLine: string; ageGroups: string[]
  audience: string; campaign: string; sourceUrl: string; sourceStatus: SourceStatus
}
export interface StageReview { status: ReviewStatus; byUid: string; byName: string; signature: string; reviewedAt: string | null; manual?: boolean }
export interface UserProfile { uid: string; fullName: string; email: string; username?: string; position?: AccountPosition; contactEmail?: string; role: Role; active: boolean; createdAt: string; updatedAt: string }
export interface AccountInput { username: string; password?: string; fullName: string; salary: number; position: AccountPosition }
export interface BoardInput extends TaskInput { sku: string; contributions: Record<string, Contribution>; scriptReview: StageReview; mediaReview: StageReview; status: TaskStatus; publicationStatus: PublicationStatus; plannedPublishDate: string | null; publishedDate: string | null; postUrl: string | null }
export interface Assignment { fullName: string; workRole: WorkRole }
export interface Contribution { title: string; scriptUrl: string; sourceUrl: string; mediaUrl: string; note: string; status: 'pending' | 'working' | 'submitted'; submittedAt: string | null }
export interface MarketingTask {
  id: string; title: string; description: string; taskType: TaskType; referenceUrl: string
  sku: string; skuNumber: number | null; contentInfo: ContentInfo; scriptReview: StageReview; mediaReview: StageReview
  assigneeUids: string[]; submittedUids: string[]; assignments: Record<string, Assignment>; contributions: Record<string, Contribution>
  createdByUid: string; createdByName: string; status: TaskStatus
  deadlineAt: string; periodKey: string
  requiresPublishing: boolean; publicationStatus: PublicationStatus; plannedPublishDate: string | null; publishedDate: string | null; postUrl: string | null
  createdAt: string; updatedAt: string; completedAt: string | null
}
export interface TaskInput {
  title: string; description: string; taskType: TaskType; referenceUrl: string
  contentInfo: ContentInfo
  assignees: { uid: string; workRole: WorkRole }[]; deadlineAt: string
  requiresPublishing: boolean
}
