import type { ContentInfo, Contribution, MarketingTask, TaskInput, UserProfile, PublicationStatus, ReviewStage } from '../types'
import { firebaseApi } from './firebaseApi'
export { ApiError } from './api'
export { firebaseConfigError } from './firebase'
export type ReportInput = Pick<Contribution, 'title' | 'scriptUrl' | 'sourceUrl' | 'mediaUrl' | 'note'> & { submit: boolean }
export interface PublicationInput { publicationStatus: PublicationStatus; publishedDate: string | null; postUrl: string | null; requiresPublishing?: boolean; plannedPublishDate?: string | null }
export interface DataApi {
  loginGoogle(): Promise<{ user: UserProfile }>
  logout(): Promise<{ ok: boolean }>
  me(): Promise<{ user: UserProfile }>
  users(): Promise<{ users: UserProfile[] }>
  updateUser(uid: string, data: Pick<UserProfile, 'fullName' | 'role' | 'active'>): Promise<{ user: UserProfile }>
  tasks(period: string): Promise<{ tasks: MarketingTask[] }>
  task(id: string): Promise<{ task: MarketingTask }>
  watchTask(id: string, next: (task: MarketingTask | null) => void, error: (error: Error) => void): () => void
  watchTasks(user: UserProfile, period: string | null, next: (tasks: MarketingTask[]) => void, error: (error: Error) => void): () => void
  watchContentTasks(user: UserProfile, next: (tasks: MarketingTask[]) => void, error: (error: Error) => void): () => void
  createTask(data: TaskInput): Promise<{ task: MarketingTask }>
  deleteTask(id: string): Promise<{ deletedId: string }>
  deleteTasks(ids: string[]): Promise<{ deletedIds: string[] }>
  duplicateTask(id: string, count: number, deadlineAt: string): Promise<{ count: number; firstSku: string; lastSku: string; periodKey: string }>
  updateTask(id: string, data: TaskInput): Promise<{ task: MarketingTask }>
  renameTask(id: string, title: string): Promise<{ task: MarketingTask }>
  ensureSkus(ids: string[]): Promise<void>
  updateContentInfo(id: string, changes: Partial<ContentInfo>): Promise<{ task: MarketingTask }>
  reviewStage(id: string, stage: ReviewStage, status: 'approved' | 'needs_revision'): Promise<{ task: MarketingTask }>
  report(id: string, data: ReportInput): Promise<{ task: MarketingTask }>
  review(id: string, status: 'done' | 'needs_revision' | 'cancelled'): Promise<{ task: MarketingTask }>
  publish(id: string, data: PublicationInput): Promise<{ task: MarketingTask }>
}
export const api: DataApi = firebaseApi
