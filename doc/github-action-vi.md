## Triển khai bằng GitHub Actions

**Cấu hình GitHub Repository**

1. Fork hoặc clone repository: [https://github.com/eoao/cloud-mail](https://github.com/eoao/cloud-mail)
2. Truy cập vào trang Cài đặt (Settings) của GitHub repository của bạn.
3. Đi tới **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
4. Thêm các Secrets sau:

| Tên Secret | Bắt buộc | Mục đích sử dụng |
| --- | :---: | --- |
| `CLOUDFLARE_API_TOKEN` | ✅ | Mã token API Cloudflare (cần có quyền Workers và các tài nguyên liên quan) |
| `CLOUDFLARE_ACCOUNT_ID` | ✅ | ID tài khoản Cloudflare của bạn |
| `D1_DATABASE_ID` | ✅ | ID cơ sở dữ liệu Cloudflare D1 của bạn |
| `KV_NAMESPACE_ID` | ✅ | ID không gian tên Cloudflare KV của bạn |
| `R2_BUCKET_NAME` | ✅ | Tên bucket lưu trữ Cloudflare R2 của bạn |
| `DOMAIN` | ✅ | Danh sách tên miền dùng cho dịch vụ email (ví dụ: `["domain.com"]`, nhiều tên miền phân tách bằng dấu phẩy) |
| `ADMIN` | ✅ | Địa chỉ email quản trị viên của bạn (ví dụ: `admin@example.com`) |
| `JWT_SECRET` | ✅ | Chuỗi ký tự ngẫu nhiên dài dùng để tạo và xác thực JWT |
| `INIT_URL` | ❌ | (Tùy chọn) URL Worker để tự động khởi tạo database sau khi deploy (tham khảo cách khởi tạo thủ công bên dưới) |

---

**Lấy Cloudflare API Token**

1. Truy cập [Cloudflare Dashboard - API Tokens](https://dash.cloudflare.com/profile/api-tokens).
2. Nhấn **Create Token** (Tạo mã Token).
3. Chọn mẫu **"Edit Cloudflare Workers"** và bổ sung các quyền tương ứng như hình minh họa:
   ![Quyền Cloudflare API Token](https://i.miji.bid/2025/07/07/dc2e1dc8dcd217644759c46c6c705de1.png)
4. Lưu mã token và sao chép vào GitHub Secrets với tên `CLOUDFLARE_API_TOKEN`.

**Lấy Cloudflare Account ID**
1. ID tài khoản có thể tìm thấy trong phần cài đặt tài khoản trên Cloudflare Dashboard (hoặc thanh bên phải trang Workers).
2. Sao chép và thêm vào GitHub Secrets với tên `CLOUDFLARE_ACCOUNT_ID`.

**Chạy quy trình (Workflow)**
1. Truy cập vào tab **Actions** trên GitHub và kích hoạt chạy workflow thủ công. Sau này khi đồng bộ từ nhánh upstream, hệ thống sẽ tự động deploy lên Cloudflare Workers. Nếu không cấu hình `INIT_URL`, bạn cần mở trình duyệt và truy cập thủ công đường dẫn `https://<tên-miền-của-bạn>/api/init/<jwt_secret_của_bạn>` để khởi tạo cơ sở dữ liệu.
2. Để tự động đồng bộ code từ upstream, bạn có thể dùng bot hoặc nhấn nút **Sync Fork / Sync Upstream** trên GitHub.
