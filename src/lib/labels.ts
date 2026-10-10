import type { Priority, PublicationStatus, Role, TaskStatus, TaskType } from '../types'
export const roleLabel: Record<Role, string> = { admin: 'ADMIN', manager: 'Quản lý', employee: 'Nhân viên' }
export const statusLabel: Record<TaskStatus, string> = { todo: 'Cần làm', in_progress: 'Đang thực hiện', waiting_review: 'Chờ duyệt', needs_revision: 'Cần chỉnh sửa', done: 'Hoàn thành', cancelled: 'Đã hủy' }
export const typeLabel: Record<TaskType, string> = { video: 'Video', content: 'Nội dung', seo: 'SEO', design: 'Thiết kế', other: 'Khác' }
export const priorityLabel: Record<Priority, string> = { low: 'Thấp', normal: 'Bình thường', high: 'Cao', urgent: 'Khẩn' }
export const publicationLabel: Record<PublicationStatus, string> = { not_applicable: 'Không áp dụng', not_scheduled: 'Chưa có lịch', scheduled: 'Chờ đăng', published: 'Đã đăng' }
