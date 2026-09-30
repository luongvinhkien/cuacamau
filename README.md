# Live Order — quản lý đơn livestream

Web app responsive cho người bán livestream độc lập. TikTok chỉ dùng để live giới thiệu hàng; ứng dụng này không tích hợp TikTok Shop, Affiliate, comment hay API TikTok.

## Công nghệ

- ASP.NET Core Web API + giao diện HTML/CSS/JavaScript trong `wwwroot`
- Entity Framework Core, provider MySQL Pomelo 9 (EF Core 9)
- MySQL đặt trên máy chủ; điện thoại chỉ cần trình duyệt Chrome/Safari
- Nhận giọng nói qua Web Speech API tiếng Việt nếu trình duyệt cho phép. Có ô nhập câu thủ công để dùng khi thiết bị khác đang giữ microphone.

## Tính năng đang có

- Đăng nhập Admin, đăng xuất, đổi mật khẩu; mật khẩu được hash. Tạo tài khoản lần đầu từ biến môi trường.
- CRUD/tìm kiếm khách hàng, lịch sử mua và tổng tiền; không xóa hồ sơ đã có đơn.
- CRUD sản phẩm theo mã, màu, size, giá và tồn.
- Phân tích câu nói thành khách/sản phẩm/size/màu/số lượng/giá; gợi ý khách gần giống. Không tự chọn khách gần giống.
- Bản nháp đơn phải được người bán kiểm tra và xác nhận mới lưu; khách mới có thể để trống SĐT/địa chỉ.
- Danh sách và lọc đơn theo ngày/trạng thái ở giao diện; cập nhật trạng thái; tổng hợp soạn hàng theo ngày; báo cáo cơ bản và xuất CSV mở được bằng Excel.
- Logging console, Problem Details, health endpoint `/health`, migration khởi tạo.

Parser hiện là bộ quy tắc nền để có thể thay engine sau này. Cần kiểm tra lại mọi trường trước khi xác nhận, đặc biệt giá khi câu nói không có đơn vị rõ ràng. Nhận giọng nói phụ thuộc trình duyệt, quyền microphone, HTTPS và giới hạn chiếm microphone của điện thoại.

## Yêu cầu

- .NET 10 SDK khi phát triển, .NET 10 ASP.NET Core Runtime khi chạy máy chủ
- MySQL 8.x hoặc dịch vụ MySQL tương thích; database/schema cần tạo trước
- HTTPS khi truy cập từ điện thoại để microphone hoạt động trên trình duyệt

## Chạy local trên Windows PowerShell

1. Tạo database trống, ví dụ `liveorder`, trên MySQL cục bộ hoặc máy chủ thử nghiệm.
2. Mở PowerShell tại thư mục dự án và cấu hình biến môi trường cho phiên hiện tại. Database cần được tạo trước; ví dụ lệnh SQL chạy bằng tài khoản quản trị MySQL: `CREATE DATABASE liveorder CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci; CREATE USER 'liveorder_app'@'%' IDENTIFIED BY 'YOUR_SECRET'; GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES ON liveorder.* TO 'liveorder_app'@'%';`. Thu hẹp host `%` theo IP ứng dụng nếu nhà cung cấp hỗ trợ.

```powershell
$env:LIVEORDER_MYSQL = 'Server=127.0.0.1;Port=3306;Database=liveorder;User=liveorder_app;Password=YOUR_SECRET;'
$env:LIVEORDER_ADMIN_USER = 'admin'
$env:LIVEORDER_ADMIN_PASSWORD = 'Use-a-unique-password-10-chars-minimum'
```

3. Restore/build/run:

```powershell
dotnet restore --configfile .\NuGet.Config
dotnet run
```

4. Mở URL HTTPS mà `dotnet run` in ra. Chấp nhận dev certificate local nếu cần. Đăng nhập bằng biến Admin vừa đặt.

Mật khẩu Admin được tạo một lần khi bảng Users còn trống. Đổi nó ngay sau lần đăng nhập đầu tiên. Biến môi trường phải được cấu hình trong môi trường của tiến trình web service trên hosting; không commit connection string hoặc secret vào source.


### Dùng MySQL cloud từ PowerShell

Tạo MySQL service trên Aiven, tạo database riêng (ví dụ `liveorder`), tạo/lấy user kết nối, rồi tải CA certificate từ trang Overview của service. Aiven Free hiện phù hợp để thử nghiệm, giới hạn 1 GB RAM và 1 GB storage; service có thể tự tắt sau thời gian không hoạt động. Không dùng làm bản sao dữ liệu duy nhất cho hoạt động bán hàng.

Tại thư mục dự án chạy:

```powershell
.\Run-Local.ps1
```

Script sẽ hỏi host, port, database, user, đường dẫn file CA và nhập ẩn mật khẩu DB/Admin. Connection string chỉ được đặt tạm trong môi trường của tiến trình chạy và bị xóa khi app dừng. Ứng dụng tự áp dụng migration khi kết nối thành công. Cần internet để VPS/dev PC kết nối tới Aiven.
## Deploy VPS / hosting

1. Cài .NET 10 ASP.NET Core Runtime và MySQL 8; tạo database riêng và user MySQL chỉ có quyền trên database đó.
2. Publish trên máy build: `dotnet publish -c Release -o publish`.
3. Đưa thư mục publish lên VPS. Đặt `LIVEORDER_MYSQL`, `LIVEORDER_ADMIN_USER`, `LIVEORDER_ADMIN_PASSWORD` trong service manager (systemd, IIS app pool environment, container secret, hoặc control panel của hosting).
4. Chạy ứng dụng sau reverse proxy HTTPS (IIS/Nginx/Caddy). Chỉ mở HTTPS ra Internet; giới hạn quyền truy cập MySQL theo IP/user.
5. Mở `/health` để kiểm tra tiến trình và kết nối database; xem stdout/stderr của service để chẩn đoán lỗi.

Cookie đăng nhập được đánh dấu HttpOnly và SameSite Strict. Hãy dùng HTTPS trên hosting. Chưa cấu hình phân quyền nhiều vai trò, chống brute-force, SMTP reset password hoặc multi-shop.

## Backup MySQL

Giữ bản backup ngoài VPS hoặc đẩy sang object storage khác; không để bản duy nhất cùng ổ đĩa database. Ví dụ PowerShell, dùng secret từ môi trường và chạy bằng Task Scheduler mỗi ngày:

```powershell
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = "D:\Backups\liveorder-$stamp.sql"
mysqldump --defaults-extra-file=$env:MYSQL_BACKUP_CNF --single-transaction --routines --triggers --host=$env:MYSQL_HOST liveorder | Set-Content -Encoding utf8 $backup
```

Lập lịch hằng ngày, giữ bản tuần (ví dụ Chủ nhật) dài hạn, sao chép encrypted/off-host và định kỳ thử restore vào database staging. File `MYSQL_BACKUP_CNF` chỉ cho tài khoản backup đọc và chứa cấu hình `[client]`, `user=...`, `password=...`; bảo vệ ACL của file này. Tránh đưa mật khẩu vào tham số dòng lệnh hoặc log.

## Cấu trúc

```text
Controllers/   REST endpoints
Data/          EF Core DbContext
DTOs/          (mở rộng DTO tách biệt ở giai đoạn tiếp theo)
Migrations/    EF Core schema migration
Models/        Entities
Services/      Phân tích câu nói
wwwroot/       Responsive frontend
```

## Kế hoạch phát triển

1. Hoàn thiện phân quyền Admin/nhân viên, validation nghiệp vụ tồn kho và kiểm thử parser bằng dữ liệu livestream thực tế.
2. Mở rộng bộ lọc server-side, phân trang, xuất Excel `.xlsx`, báo cáo theo khoảng ngày/sản phẩm/khách.
3. Bổ sung quy trình soạn/đóng gói theo người thao tác và lưu trạng thái checkbox trên server.
4. Tích hợp Speech-to-Text phía server có thể thay thế; giữ phương án nhập chữ và bước xác nhận thủ công.
5. Cấu hình backup ngoài host, retention/restore runbook, cảnh báo lỗi và triển khai production.



