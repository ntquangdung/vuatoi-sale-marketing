import type { AccountInput, BoardInput, ContentInfo, Contribution, MarketingTask, TaskInput, UserProfile, PublicationStatus, ReviewStage } from '../types'
import { firebaseApi } from './firebaseApi'
export { ApiError } from './api'
export { firebaseConfigError } from './firebase'
export type ReportInput = Pick<Contribution, 'title' | 'scriptUrl' | 'sourceUrl' | 'mediaUrl' | 'note'> & { submit: boolean }
export interface PublicationInput { publicationStatus: PublicationStatus; publishedDate: string | null; postUrl: string | null; requiresPublishing?: boolean; plannedPublishDate?: string | null }
export interface DataApi {
  login(username: string, password: string): Promise<{ user: UserProfile }>
  account(data: AccountInput, uid?: string, migration?: boolean): Promise<{ user: UserProfile }>
  salary(uid: string): Promise<number>
  resetSkus(month: string): Promise<{ count: number; nextSku: string }>
  editBoard(id: string, data: BoardInput, expectedUpdatedAt: string): Promise<{ task: MarketingTask }>
  logout(): Promise<{ ok: boolean }>
  me(): Promise<{ user: UserProfile }>
  users(): Promise<{ users: UserProfile[] }>
  updateUser(uid: string, data: Pick<UserProfile, 'fullName' | 'role' | 'active' | 'position'>): Promise<{ user: UserProfile }>
  setEmployeeAccess(uid: string, active: boolean): Promise<{ user: UserProfile }>
  setUsersArchived(uids: string[], archived: boolean): Promise<{ uids: string[] }>
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
  renameSku(id: string, sku: string): Promise<{ task: MarketingTask }>
  ensureSkus(ids: string[]): Promise<void>
  updateContentInfo(id: string, changes: Partial<ContentInfo>): Promise<{ task: MarketingTask }>
  reviewStage(id: string, stage: ReviewStage, status: 'approved' | 'needs_revision'): Promise<{ task: MarketingTask }>
  report(id: string, data: ReportInput): Promise<{ task: MarketingTask }>
  review(id: string, status: 'done' | 'needs_revision' | 'cancelled'): Promise<{ task: MarketingTask }>
  publish(id: string, data: PublicationInput): Promise<{ task: MarketingTask }>
}
export const api: DataApi = firebaseApi
