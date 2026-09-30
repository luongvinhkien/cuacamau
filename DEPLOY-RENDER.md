# Publicar Live Order gratis en Render + Aiven MySQL

> Render Free phù hợp để thử nghiệm và sử dụng nhẹ. Service sẽ ngủ sau 15 phút không có truy cập, lần mở tiếp theo có thể mất khoảng một phút và có giới hạn sử dụng hàng tháng. Aiven MySQL Free tem 1 GB de RAM e 1 GB de armazenamento e pode ser desligado após inatividade. Não use esta configuração como cópia única dos dados de venda.

## Preparar

1. **Bảo vệ tài khoản trước khi mở Internet:** đăng nhập ứng dụng đang chạy, vào **Đổi mật khẩu** và đổi mật khẩu Admin hiện tại thành mật khẩu riêng, dài ít nhất 12 ký tự. Cơ sở dữ liệu Aiven đã có tài khoản `admin`, vì vậy `LIVEORDER_ADMIN_PASSWORD` lúc deploy không tự đổi mật khẩu đã lưu; đặt biến này trùng mật khẩu mới bạn vừa chọn.
2. Kiểm tra dịch vụ MySQL Aiven đang ở trạng thái **Running** và file CA `ca.pem` còn trên máy. Ứng dụng cần database đang hoạt động để chạy migration khi khởi động.
3. Tạo một repository **Private** trên GitHub. Đây là mã nguồn riêng; URL ứng dụng sau khi deploy vẫn công khai để bạn mở trên điện thoại.
4. Tại thư mục dự án, chạy:

```powershell
git init -b main
git add .
git status --short
git commit -m "Prepare Live Order for Render"
git remote add origin https://github.com/<TEN_TAI_KHOAN>/<TEN_REPO>.git
git push -u origin main
```

Trước khi commit, xác nhận `ca.pem`, file `.docx`, `.appdata`, `bin`, `obj` và `appsettings.Development.json` không xuất hiện trong `git status`. Các file này đã được thêm vào ignore.

## Tạo web service Render

1. Tạo tài khoản Render, mở **New → Blueprint**, kết nối GitHub và chọn repository private ở trên. Render đọc `render.yaml`; chọn Singapore và Free khi được hỏi.
2. Thêm biến `LIVEORDER_MYSQL` trong Environment của service, theo mẫu dưới đây. Dùng host, port, database và user hiện trên Aiven; không dán connection string vào README, GitHub hay tin nhắn công khai.

```text
Server=<AIVEN_HOST>;Port=<AIVEN_PORT>;Database=<DATABASE_NAME>;User ID=<AIVEN_USER>;Password=<AIVEN_PASSWORD>;SslMode=VerifyCA;SslCa=/etc/secrets/ca.pem;
```

3. Mở **Environment → Secret Files**, thêm file tên `ca.pem` và tải lên file CA đã tải từ Aiven. Render sẽ cung cấp file tại `/etc/secrets/ca.pem` khi chạy.
4. Đặt `LIVEORDER_ADMIN_PASSWORD` bằng đúng mật khẩu Admin mới đã đổi ở bước chuẩn bị. Không đặt `LIVEORDER_RESET_ADMIN_PASSWORD`.
5. Chọn **Save, rebuild, and deploy**. Chờ service **Live**; mở `/health`, sau đó mở URL `https://<ten-service>.onrender.com` và đăng nhập bằng `admin` cùng mật khẩu mới.

Ứng dụng áp dụng EF Core migrations khi khởi động. Hãy kiểm tra log deploy; nếu lỗi kết nối, xác nhận MySQL Aiven đang Running, tên database/port/user/password đúng và file CA đã được upload. Giữ bản backup Aiven hoặc tải backup ra nơi khác định kỳ.

## Cập nhật sau này

Sau khi sửa code:

```powershell
git add .
git commit -m "Update Live Order"
git push
```

Render tự deploy commit mới từ nhánh `main`.

## Lưu ý về gói Free

- Render Free tự dừng service sau 15 phút không truy cập; lần mở tiếp theo có thể mất khoảng một phút để khởi động.
- Aiven Free có 1 GB RAM/1 GB lưu trữ và có thể tắt MySQL nếu không có hoạt động trong thời gian dài. Nếu database tắt, ứng dụng không khởi động được tới khi bạn bật lại MySQL.
- Gói Free có giới hạn tài nguyên/lưu lượng. Kiểm tra trang Billing/Usage của Render và Aiven; không coi dịch vụ free là backup hay hosting có SLA.
