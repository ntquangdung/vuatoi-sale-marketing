# SALE - MARKETING · VUA TỎI

Web riêng cho SALE - MARKETING VUA TỎI, tiếng Việt, giao diện trắng/xanh dương.
React + TypeScript + Vite; đăng nhập Google và dữ liệu Cloud Firestore của project **vuatoi-mkt**.
Backend dùng dịch vụ Firebase và Security Rules. Khi đưa lên hosting, ứng dụng không cần máy chủ Node local,
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
Firebase web config là thông tin công khai. Quyền truy cập được kiểm tra bằng Google Authentication và Firestore Rules.
Không đưa service account hoặc thông tin đăng nhập vào frontend/Git.

## Tài khoản và quyền

- Chỉ đăng nhập Google; lần đầu tự tạo hồ sơ **nhân viên**.
- ADMIN hiện tại: **dungbadao0704@gmail.com**; đăng nhập lại giữ nguyên quyền này.
- Nhân viên xem task được giao và sửa phần việc của mình.
- ADMIN quản lý tên, vai trò, khóa/mở nhân sự; không tự khóa hoặc tự hạ quyền.
- Quản lý xem toàn đội, giao và duyệt task; không quản lý vai trò.
- Firebase UID dùng nội bộ, không hiển thị trong giao diện.

## Công việc nhiều người

1. Tạo task với tên, yêu cầu, link tài liệu và deadline **0,25–720 giờ**.
2. Giao **1–8 nhân viên**, chọn phần việc Content, Media hoặc Khác.
3. Content nộp **tiêu đề + link kịch bản**; Media nộp **link media đã edit**.
4. Mỗi người lưu nháp và nộp riêng; nộp đủ thì task hiển thị **Chờ duyệt**.
5. ADMIN/Quản lý duyệt hoàn thành, yêu cầu chỉnh sửa hoặc hủy.
6. Kết quả cũ giữ lại khi yêu cầu chỉnh sửa. Người đã nộp có thể nộp lại kết quả.
7. Task cần đăng bài/video có ngày dự kiến, trạng thái đăng và link bài đã đăng.

Không có phần trăm hoàn thành. Link mở ở tab mới; không upload video/file lên Firebase Storage.
Các phần việc cập nhật nguyên tử, hai người lưu đồng thời không ghi đè kết quả của nhau.

## Bảng nội dung cho ADMIN / quản lý

Mục **Bảng nội dung** dùng chung dữ liệu với Công việc. Mỗi dòng là một task, kể cả task nhiều Content / Media.

- Menu trái mang tên **SALE - MARKETING VUA TỎI**. Nút menu trên thanh đầu trang thu gọn thành các biểu tượng
  hoặc mở đầy đủ; trình duyệt ghi nhớ lựa chọn. Trên điện thoại, menu mở / đóng dạng ngăn kéo.
- Bảng dùng toàn bộ chiều rộng còn lại và dòng gọn hơn để xem nhiều nội dung.
- Bấm **Thêm dòng** trên thanh công cụ hoặc **Thêm dòng nội dung** cuối bảng để nhập ngay trong bảng:
  Page, tiêu đề, nhiều nhân viên cùng vai trò Content / Media / Khác, deadline và các thông tin bổ sung.
  Bấm **Lưu dòng** để cấp SKU và đồng bộ vào cùng dữ liệu Công việc; không cần mở form Tạo công việc.

- SKU tự tăng `vuatoi.0001`, `vuatoi.0002`… bằng transaction Firestore. Hai người tạo cùng lúc không trùng mã.
- Task cũ được cấp mã một lần khi quản lý mở bảng; giữ nguyên người giao, deadline và kết quả đã nộp.
- Các cột gồm Page, Content, loại video, tuyến nội dung, độ tuổi, đối tượng, chiến dịch / sản phẩm,
  tiêu đề / thumbnail, kịch bản, duyệt kịch bản, source / link source, Media / link edit,
  người kiểm duyệt media, duyệt media, đăng Page / ngày đăng / link bài, deadline và trạng thái task.
- Nhấp ô để sửa thông tin; nhấp SKU hoặc tiêu đề để mở task. Kịch bản / link edit lấy từ phần việc nhân viên đã nộp.
- Duyệt kịch bản và media riêng; yêu cầu sửa chỉ mở lại phần việc tương ứng. Nếu nhân viên đổi kết quả hoặc nộp lại,
  phần đó trở về chờ duyệt. Duyệt hoàn thành task duyệt cả các phần việc đã nộp đủ.
- Tìm SKU / Page / tiêu đề / nhân viên, lọc Page / loại video / trạng thái duyệt hoặc đăng bài,
  sắp xếp SKU và chọn cột hiển thị. Tùy chọn cột lưu riêng cho từng tài khoản trên trình duyệt.
- Mặc định xem tháng đã chọn; bật **Toàn bộ tháng** để xem lịch sử. Truy vấn lịch sử dừng khi rời bảng.
- Sửa thông tin và duyệt được kiểm tra quyền trong Firebase Rules; nhân viên cập nhật phần việc của mình trong Công việc.

## Deadline và thông báo trong tài khoản

Deadline tính từ lúc tạo; sửa số giờ vẫn tính từ thời điểm tạo ban đầu. Giao diện dùng giờ Việt Nam.
Thời điểm nộp đủ kết quả dùng để đánh giá đúng hạn, tránh tính nhân viên trễ vì quản lý duyệt sau đó.

- Cảnh báo tại **chuông** khi còn tối đa 30 phút hoặc đã trễ.
- Nhân viên chỉ nhận cảnh báo cho phần việc được giao và chưa nộp.
- ADMIN và quản lý nhận cảnh báo toàn đội đến khi tất cả thành viên nộp đủ.
- Cảnh báo bao gồm task ngoài tháng đang xem.
- Mở task từ thông báo hoặc bấm **Đánh dấu tất cả đã đọc** để ghi nhận đã đọc.
- Trạng thái đã đọc lưu theo tài khoản Google, đồng bộ qua Firestore.
- Chuyển từ sắp đến hạn sang trễ, hoặc thay đổi deadline, tạo cảnh báo chưa đọc mới.
- Kiểm tra thời gian mỗi 15 giây khi mở web; kiểm tra lại ngay khi quay lại tab.
  Khi đóng web, lần mở tiếp theo vẫn hiển thị cảnh báo đang áp dụng.

Không gửi thông báo ra trình duyệt khi đóng web theo lựa chọn mới của người dùng.
Không có worker, API gửi push, cron hoặc yêu cầu nâng cấp Firebase Blaze.
Firebase hiện dùng Spark; mức sử dụng chịu hạn mức của gói miễn phí.

## Dữ liệu

Firestore `(default)` tại Singapore:

- `users/{uid}`: tên, email Google, vai trò, trạng thái hoạt động.
- `tasks/{id}`: SKU, yêu cầu, người được giao, kết quả từng người, thông tin nội dung, duyệt kịch bản / media,
  deadline và thông tin đăng bài.
- `counters/taskSku`: số thứ tự SKU và task được cấp gần nhất, cập nhật nguyên tử cùng task; nhân viên không truy cập được.
- `users/{uid}/deadlineReads/{taskId}`: giai đoạn cảnh báo đã đọc và deadline tương ứng.

Security Rules chặn truy cập không đăng nhập, sửa phần người khác, tự nâng quyền và tự duyệt hoàn thành.
Giao diện không sử dụng API SQLite đời trước trong `server/`.

## GitHub / Vercel

1. Đưa source lên GitHub; không đưa `.env.local`, `.tools`, `.data`, `node_modules`, `dist` lên Git.
2. Vercel import repository, preset **Vite**, build `npm run build`, output **dist**.
3. Thêm các biến `VITE_FIREBASE_*` theo `.env.example`.
4. Thêm domain Vercel vào Firebase Authentication → Settings → Authorized domains.
5. Redeploy sau khi đổi biến môi trường. `vercel.json` đã cấu hình SPA rewrite và security headers.

Chỉ cần hosting frontend; không cấu hình secret backend, cron hoặc máy local chạy liên tục.
Repository riêng tư: [ntquangdung/vuatoi-sale-marketing](https://github.com/ntquangdung/vuatoi-sale-marketing).
Vercel Hobby giới hạn sử dụng cá nhân, phi thương mại; chọn gói phù hợp khi triển khai nội bộ doanh nghiệp
theo [tài liệu Vercel](https://vercel.com/docs/plans/hobby).

## Kiểm tra / triển khai rules

```powershell
npm run build
npm test
npm run test:rules
npm run test:firebase-access
npx firebase-tools deploy --only firestore,auth --project vuatoi-mkt --account dungbadao0704@gmail.com
```

Rules tests dùng Firestore Emulator với project demo, không tạo nhân viên hoặc task giả trên Firebase thật.
Cần Java 21+ và Firebase CLI; runner xử lý đường dẫn Windows có dấu bằng thư mục tạm không dấu.

