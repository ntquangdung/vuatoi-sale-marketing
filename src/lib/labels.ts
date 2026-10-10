import type { PublicationStatus, Role, TaskStatus, TaskType } from '../types'
export const roleLabel: Record<Role, string> = { admin: 'ADMIN', manager: 'Quản lý', employee: 'Nhân viên' }
export const statusLabel: Record<TaskStatus, string> = { todo: 'Cần làm', in_progress: 'Đang thực hiện', waiting_review: 'Chờ duyệt', needs_revision: 'Cần chỉnh sửa', done: 'Hoàn thành', cancelled: 'Đã hủy' }
export const typeLabel: Record<TaskType, string> = { video: 'Video', content: 'Nội dung', seo: 'SEO', design: 'Thiết kế', other: 'Khác' }
export const publicationLabel: Record<PublicationStatus, string> = { not_applicable: 'Không yêu cầu', not_scheduled: 'Chưa cập nhật', scheduled: 'Đã lên lịch', published: 'Đã đăng' }
