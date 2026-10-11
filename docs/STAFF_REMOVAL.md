# Xóa nhân sự khỏi danh sách

- ADMIN xóa hoặc khôi phục nhân sự khác, gồm nhân viên, quản lý và ADMIN khác.
- Quản lý chỉ xóa hoặc khôi phục nhân viên.
- Không xóa tài khoản đang đăng nhập.
- Chọn nhiều hồ sơ bằng ô vuông đầu dòng, tối đa 8 hồ sơ mỗi lần. Thay đổi hồ sơ và trạng thái chặn truy cập được ghi trong một transaction Firestore.
- Xóa đặt `archived: true`, `active: false`. Hồ sơ chuyển vào **Đã xóa**, không xuất hiện trong danh sách hiện tại hoặc báo cáo nhân sự. Task vẫn giữ tên và kết quả cũ.
- **Khôi phục** đưa hồ sơ về **Đã thu hồi quyền**, giữ `active: false`. ADMIN hoặc quản lý phải cấp lại quyền riêng trước khi tài khoản đăng nhập được.
- Không xóa vĩnh viễn hồ sơ, Firebase Auth, tên đăng nhập đã giữ chỗ, mức lương hoặc task. Không cho đăng ký lại để vượt qua trạng thái bị thu hồi.
