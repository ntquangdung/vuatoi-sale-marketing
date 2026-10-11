# Tài khoản, phân quyền và SKU theo tháng

## Sử dụng

- Đăng nhập bằng tên tài khoản + mật khẩu; không có đăng ký công khai.
- ADMIN: Nhân sự → Cấp tài khoản. Nhập họ tên, tài khoản, mật khẩu, lương VNĐ/tháng và vị trí Content/Media.
- Với nhân sự cũ, chọn Cấp tài khoản ngay trên hồ sơ đó để giữ UID và lịch sử công việc. Không tạo hồ sơ thay thế.
- Tài khoản & lương: ADMIN đổi mật khẩu, lương, vị trí. Để trống mật khẩu để giữ nguyên. Mật khẩu không được lưu trong Firestore hay trả về sau khi tạo.
- Quản lý và ADMIN thu hồi/cấp lại quyền nhân viên. Hồ sơ và tên trong task cũ được giữ lại. Không cho tự tạo lại hồ sơ để vượt quyền đã thu hồi.
- Mức lương lưu riêng tại `staffSalary/{uid}`; chỉ ADMIN đọc được.

## SKU

- Mỗi tháng có bộ đếm riêng `skuMonths/YYYY-MM`, theo tháng của deadline (giờ Việt Nam).
- Tháng mới bắt đầu `vuatoi.0001`. Xóa task không làm lấp số đã xóa.
- SKU duy nhất **trong từng tháng**. Khi xem toàn bộ tháng, tháng được hiển thị dưới SKU.
- ADMIN/quản lý đổi SKU; mã dạng `vuatoi.N` lớn hơn hiện tại sẽ nâng bộ đếm tháng.
- Bảng nội dung → Reset SKU → xác nhận tháng: đánh số lại tất cả task của tháng, giữ nội dung, người làm và kết quả. Task tạo tiếp nhận số sau dòng cuối. Tháng trống nhận 0001.
- Chuyển deadline sang tháng khác tự cấp SKU theo tháng đích, trừ khi chủ động nhập SKU khác chưa tồn tại ở tháng đích.
- Tạo, sao chép, sửa SKU, chuyển tháng và reset dùng transaction trên cùng bộ đếm tháng để tránh trùng mã.

## Chỉnh sửa bảng

- ADMIN/quản lý bấm bút chì cuối dòng để sửa tất cả: phân loại, SKU, người làm, deadline, tiêu đề, link tài liệu/kịch bản/source/media, kết quả từng người, kiểm duyệt/người duyệt, trạng thái công việc và thông tin đăng bài.
- Cho sửa cả công việc đã đóng. Nếu task vừa được cập nhật bởi người khác, trình sửa yêu cầu mở lại trước khi lưu.
- Nhân viên vẫn chỉ sửa phần mình và thông tin đăng bài được giao. Chỉ ADMIN xóa task.

## Backend trên Vercel

`api/admin.mjs` cấp/đổi tài khoản; `api/board.mjs` xử lý SKU và sửa toàn bộ dòng. Mọi API kiểm tra Firebase ID token, trạng thái hồ sơ và vai trò từ Firestore.

Kết nối Google Cloud bằng Vercel OIDC + Workload Identity Federation, không đưa khóa dịch vụ hoặc credential cá nhân lên GitHub/Vercel.

Cấu hình dự kiến (cần chủ project phê duyệt trước khi áp dụng):

- Firebase project `vuatoi-mkt` / số `327588256790`.
- Service account `vuatoi-accounts@vuatoi-mkt.iam.gserviceaccount.com`.
- Quyền `roles/firebaseauth.admin` (quản lý tài khoản Auth) và `roles/datastore.user` (đọc/ghi database Firestore của project). API phải tự kiểm tra phân quyền vì Admin SDK bỏ qua Firestore Rules.
- Pool `vuatoi-vercel`; provider `production`.
- Issuer `https://oidc.vercel.com/vuatoi-mkt`; audience `https://vercel.com/vuatoi-mkt`.
- Chỉ subject `owner:vuatoi-mkt:project:vuatoi-sale-marketing:environment:production` được impersonate service account với `roles/iam.workloadIdentityUser`.
- Bật APIs IAM, IAM Credentials, STS; bật Email/Password trong Firebase Authentication. Không yêu cầu bật Blaze.

Đổi các biến `FIREBASE_PROJECT_ID`, `GCP_PROJECT_NUMBER`, `GCP_WORKLOAD_IDENTITY_POOL_ID`, `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID`, `GCP_SERVICE_ACCOUNT_EMAIL` nếu chuyển project.

## Chuyển đổi ADMIN cũ

Phiên Google ADMIN cũ chỉ được đọc hồ sơ của chính mình để mở màn hình thiết lập. API `migrate` chấp nhận phiên đó một lần khi chưa có username. ADMIN tự nhập tài khoản và mật khẩu trong trình duyệt; hệ thống giữ UID và vai trò, bỏ liên kết Google, đăng nhập lại bằng mật khẩu. Sau khi đã có username, Google token không được dùng gọi API hoặc đọc công việc.

Trước khi tắt Google provider toàn project, hoàn tất cấp tài khoản cho các ADMIN còn lại hoặc giữ một phiên ADMIN cũ để thiết lập. Không tự đặt mật khẩu production trong script.

Thứ tự cutover: cấu hình OIDC/quyền dịch vụ → bật Email/Password → deploy source và Firestore Rules → kiểm tra API → người vận hành ghi `system/accountAuth` với `{ready: true}` bằng Admin SDK. API không đổi credential trước khi marker này tồn tại, tránh khóa ADMIN khi cấu hình mới chưa sẵn sàng. Không cho client đọc/ghi marker.

## Local & kiểm thử

`npm run dev`: Vite có middleware `/api/admin`, `/api/board`; Firebase Admin dùng ADC (`GOOGLE_APPLICATION_CREDENTIALS`) hoặc Firebase CLI đã đăng nhập trên máy development. Credential local không được đưa lên deploy. Có thể chỉ định module CLI bằng `FIREBASE_CLI_AUTH_MODULE`.

`npm test`: các kiểm thử nghiệp vụ giao việc/KPI/deadline.

`npm run test:rules`: Auth + Firestore Emulator project `demo-marketing-vua-toi`. Kiểm thử cấp và đổi mật khẩu, username đồng thời, chuyển ADMIN, riêng tư lương, thu hồi/cấp lại quyền, SKU theo tháng, sao chép đồng thời, reset, đổi tháng, sửa dòng đã đóng và chống ghi đè.

Không chạy script seed tài khoản hoặc reset SKU trên production để kiểm thử.
