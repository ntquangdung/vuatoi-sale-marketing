# SALE - MARKETING · VUA TỎI

Web riêng cho SALE - MARKETING VUA TỎI, tiếng Việt, giao diện trắng/xanh dương.
React + TypeScript + Vite; đăng nhập bằng tài khoản/mật khẩu do ADMIN cấp, dữ liệu Cloud Firestore của project **vuatoi-mkt**.
Backend dùng Firebase Authentication, Firestore Rules và API trên Vercel. Khi đưa lên hosting, ứng dụng không cần máy chủ Node local,
Cloud Functions, worker hoặc lịch cron.

## Chạy local

Node.js 24+:

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Mở [http://127.0.0.1:5173](http://127.0.0.1:5173).
Máy hiện tại đã có `.env.local`; không cần chép đè nếu đã cấu hình.
Firebase web config là thông tin công khai. Quyền truy cập được kiểm tra bằng Firebase Authentication và Firestore Rules.
Không đưa service account hoặc thông tin đăng nhập vào frontend/Git.

## Tài khoản và quyền

- ADMIN cấp tài khoản, mật khẩu, lương VNĐ/tháng và vị trí Content/Media tại **Nhân sự → Cấp tài khoản**.
- Nhân sự cũ được chuyển trên cùng hồ sơ để giữ lịch sử. ADMIN cũ dùng phiên đang đăng nhập để tự thiết lập tài khoản mật khẩu một lần.
- Mật khẩu được Firebase Authentication quản lý, không lưu hoặc hiển thị lại trong Firestore. Lương lưu riêng, chỉ ADMIN đọc/sửa.
- ADMIN và quản lý thu hồi/cấp lại quyền nhân viên; giữ tên và kết quả task cũ. Không tự đăng ký hồ sơ mới.
- ADMIN quản lý vai trò; không tự khóa/hạ quyền. Nhân viên chỉ sửa phần việc được giao. UID không hiển thị.
- Hướng dẫn kỹ thuật và chuyển đổi: [ACCOUNT_AND_MONTHLY_SKU.md](docs/ACCOUNT_AND_MONTHLY_SKU.md).

## Công việc nhiều người

1. Tạo task với tên, yêu cầu, link tài liệu và **ngày giờ deadline tự chọn** (giờ Việt Nam).
2. Giao **1–8 nhân viên**, chọn phần việc Content, Media hoặc Khác.
3. Content nộp **tiêu đề + link kịch bản**; Media nộp **link media đã edit**. Nhân viên tự điền link source của mình.
4. Mỗi người lưu nháp và nộp riêng; nộp đủ thì task hiển thị **Chờ duyệt**.
5. ADMIN/Quản lý duyệt hoàn thành, yêu cầu chỉnh sửa hoặc hủy.
6. Kết quả cũ giữ lại khi yêu cầu chỉnh sửa. Người đã nộp có thể nộp lại kết quả.
7. Task cần đăng bài/video: người được giao tự chọn **Đã lên lịch** và ngày đăng, hoặc **Đã đăng** kèm ngày và link bài/video. ADMIN/quản lý vẫn được cập nhật.

Không có ưu tiên, link thumbnail hoặc phần trăm hoàn thành. Font Be Vietnam Pro hỗ trợ tiếng Việt được đóng gói cùng ứng dụng. Link mở ở tab mới; không upload video/file lên Firebase Storage.
Các phần việc cập nhật nguyên tử, hai người lưu đồng thời không ghi đè kết quả của nhau.

## Bảng nội dung cho ADMIN / quản lý

Mục **Bảng nội dung** dùng chung dữ liệu với Công việc. Mỗi dòng là một task, kể cả task nhiều Content / Media.

- Menu trái mang tên **SALE - MARKETING VUA TỎI**. Nút menu trên thanh đầu trang thu gọn thành các biểu tượng
  hoặc mở đầy đủ; trình duyệt ghi nhớ lựa chọn. Trên điện thoại, menu mở / đóng dạng ngăn kéo.
- Bảng dùng toàn bộ chiều rộng còn lại và dòng gọn hơn để xem nhiều nội dung.
- Bấm **Thêm dòng** trên thanh công cụ hoặc **Thêm dòng nội dung** cuối bảng để nhập ngay trong bảng:
  Page, tiêu đề, nhiều nhân viên cùng vai trò Content / Media / Khác, deadline và các thông tin bổ sung.
  Bấm **Lưu dòng** để cấp SKU và đồng bộ vào cùng dữ liệu Công việc; không cần mở form Tạo công việc.

- SKU tự tăng riêng theo tháng deadline từ `vuatoi.0001`; không trùng mã trong cùng tháng. Xóa task không lấp số cũ.
- ADMIN và quản lý đổi SKU và bấm **Reset SKU** theo tháng. Reset đánh số lại task của tháng từ 0001, giữ người làm và kết quả; mã tiếp theo nối sau task cuối.
- Bút chì cuối dòng mở trình sửa tất cả thông tin, người làm, kết quả, kiểm duyệt, lịch đăng, deadline và trạng thái, kể cả task đã đóng. Kiểm tra dữ liệu mới trước khi ghi đè.
- Task cũ được cấp mã một lần khi quản lý mở bảng; giữ nguyên người giao, deadline và kết quả đã nộp.
- Các cột gồm Page, Content, loại video, tuyến nội dung, độ tuổi, đối tượng, chiến dịch / sản phẩm,
  tiêu đề nội dung, link kịch bản, duyệt kịch bản, source / link source, Media / link edit,
  người kiểm duyệt media, duyệt media, đăng Page / ngày đăng / link bài, deadline và trạng thái task.
- Nhấp ô để sửa thông tin hoặc tiêu đề; nhấp SKU để mở task. Link kịch bản / source / media lấy từ phần việc nhân viên tự cập nhật.
- Nút **Sao chép SKU** dưới bảng: chọn task mẫu, số bản mới (1–50, mặc định 10) và deadline. Giữ nội dung, phân loại, người được giao và vai trò; mỗi bản nhận SKU riêng. Kết quả, duyệt và lịch đăng bắt đầu lại. Một giao dịch tạo cả lô; nếu bị từ chối thì không tạo dở dang.
- Duyệt kịch bản và media riêng; yêu cầu sửa chỉ mở lại phần việc tương ứng. Nếu nhân viên đổi kết quả hoặc nộp lại,
  phần đó trở về chờ duyệt. Duyệt hoàn thành task duyệt cả các phần việc đã nộp đủ.
- Tìm SKU / Page / tiêu đề / nhân viên, lọc Page / loại video / trạng thái duyệt hoặc đăng bài,
  sắp xếp SKU và chọn cột hiển thị. Tùy chọn cột lưu riêng cho từng tài khoản trên trình duyệt.
- Mặc định xem tháng đã chọn; bật **Toàn bộ tháng** để xem lịch sử. Truy vấn lịch sử dừng khi rời bảng.
- Sửa thông tin và duyệt được kiểm tra quyền trong Firebase Rules; nhân viên cập nhật phần việc của mình trong Công việc.

## Deadline và thông báo trong tài khoản

Deadline do quản lý chọn trực tiếp ngày và giờ, không giới hạn số giờ từ lúc tạo. Giao diện dùng giờ Việt Nam (GMT+7), dữ liệu lưu timestamp UTC.
Thời điểm nộp đủ kết quả dùng để đánh giá đúng hạn, tránh tính nhân viên trễ vì quản lý duyệt sau đó.

- Cảnh báo tại **chuông** khi còn tối đa 30 phút hoặc đã trễ.
- Nhân viên chỉ nhận cảnh báo cho phần việc được giao và chưa nộp.
- ADMIN và quản lý nhận cảnh báo toàn đội đến khi tất cả thành viên nộp đủ.
- Cảnh báo bao gồm task ngoài tháng đang xem.
- Mở task từ thông báo hoặc bấm **Đánh dấu tất cả đã đọc** để ghi nhận đã đọc.
- Trạng thái đã đọc lưu theo tài khoản, đồng bộ qua Firestore.
- Chuyển từ sắp đến hạn sang trễ, hoặc thay đổi deadline, tạo cảnh báo chưa đọc mới.
- Kiểm tra thời gian mỗi 15 giây khi mở web; kiểm tra lại ngay khi quay lại tab.
  Khi đóng web, lần mở tiếp theo vẫn hiển thị cảnh báo đang áp dụng.

Không gửi thông báo ra trình duyệt khi đóng web theo lựa chọn mới của người dùng.
Không có worker, API gửi push, cron hoặc yêu cầu nâng cấp Firebase Blaze.
Firebase hiện dùng Spark; mức sử dụng chịu hạn mức của gói miễn phí.

## Dữ liệu

Firestore `(default)` tại Singapore:

- `users/{uid}`: tên, tên đăng nhập, email nội bộ, vị trí, vai trò, trạng thái hoạt động.
- `employeeAccess/{email}`: chặn / cấp lại quyền theo danh tính tài khoản, ghi nguyên tử cùng hồ sơ; nhân viên chỉ đọc được trạng thái của chính mình.
- `tasks/{id}`: SKU, yêu cầu, người được giao, kết quả từng người, thông tin nội dung, duyệt kịch bản / media,
  deadline và thông tin đăng bài.
- `skuMonths/{YYYY-MM}`: bộ đếm SKU theo tháng, chỉ API có quyền ghi.
- `staffSalary/{uid}`: mức lương riêng tư; chỉ ADMIN đọc.
- `loginNames/{username}`: giữ tên đăng nhập duy nhất; chỉ API truy cập.
- `users/{uid}/deadlineReads/{taskId}`: giai đoạn cảnh báo đã đọc và deadline tương ứng.

Security Rules chặn truy cập không đăng nhập, sửa phần người khác, tự nâng quyền và tự duyệt hoàn thành.
Giao diện không sử dụng API SQLite đời trước trong `server/`.

## GitHub / Vercel

### Bản online

- Website: [vuatoi-sale-marketing.vercel.app](https://vuatoi-sale-marketing.vercel.app).
- GitHub: `ntquangdung` (`ntquangdung2001@gmail.com`), repo riêng tư `vuatoi-sale-marketing`, nhánh `main`.
- Vercel: `dungbadao0704@gmail.com`, workspace `vuatoi-mkt`, project `vuatoi-sale-marketing`.
- Firebase: `vuatoi-mkt`; domain `vuatoi-sale-marketing.vercel.app` đã nằm trong Authorized domains.
- Vercel tự build khi đẩy thay đổi lên nhánh `main`. Các biến Firebase đã được cấu hình cho Production và Preview.

### Triển khai lại

Thiết lập kết nối OIDC cho API và chuyển tài khoản ADMIN theo [hướng dẫn](docs/ACCOUNT_AND_MONTHLY_SKU.md) trước khi chuyển bản đăng nhập mật khẩu lên production.

1. Đưa source lên GitHub; không đưa `.env.local`, `.tools`, `.data`, `node_modules`, `dist` lên Git.
2. Vercel import repository, preset **Vite**, build `npm run build`, output **dist**.
3. Thêm các biến `VITE_FIREBASE_*` theo `.env.example`.
4. Thêm domain Vercel vào Firebase Authentication → Settings → Authorized domains.
5. Redeploy sau khi đổi biến môi trường. `vercel.json` đã cấu hình SPA rewrite và security headers.

Vercel chạy frontend và các API khi có yêu cầu; kết nối Firebase bằng OIDC. Không cần cron hoặc máy local chạy liên tục.
Repository riêng tư: [ntquangdung/vuatoi-sale-marketing](https://github.com/ntquangdung/vuatoi-sale-marketing).
Vercel Hobby giới hạn sử dụng cá nhân, phi thương mại; chọn gói phù hợp khi triển khai nội bộ doanh nghiệp
theo [tài liệu Vercel](https://vercel.com/docs/plans/hobby).

## Kiểm tra / triển khai rules

```powershell
npm run build
npm test
npm run test:rules
npm run test:firebase-access
npx firebase-tools deploy --only firestore:rules --project vuatoi-mkt --account dungbadao0704@gmail.com
```

Rules tests dùng Firebase Auth + Firestore Emulator với project demo, không tạo nhân viên hoặc task giả trên Firebase thật.
Cần Java 21+ và Firebase CLI; runner xử lý đường dẫn Windows có dấu bằng thư mục tạm không dấu.

