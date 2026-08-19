<p align="center">
    <img src="doc/demo/logo.png" width="80px" />
    <h1 align="center">Cloud Mail</h1>
    <p align="center">Dịch vụ email tinh gọn, tương thích đa thiết bị chạy trên nền tảng Cloudflare Workers, hỗ trợ gửi nhận thư và tệp đính kèm 🎉</p> 
    <p align="center">
       <a href="/README.md" style="margin-left: 5px">简体中文</a> | <a href="/README-en.md" style="margin-left: 5px">English</a> | Tiếng Việt
    </p>
    <p align="center">
        <a href="https://github.com/maillab/cloud-mail/tree/main?tab=MIT-1-ov-file" target="_blank" >
            <img src="https://img.shields.io/badge/license-MIT-green" />
        </a>    
        <a href="https://github.com/maillab/cloud-mail/releases" target="_blank" >
            <img src="https://img.shields.io/github/v/release/maillab/cloud-mail" alt="releases" />
        </a>  
        <a href="https://github.com/maillab/cloud-mail/issues" >
            <img src="https://img.shields.io/github/issues/maillab/cloud-mail" alt="issues" />
        </a>  
        <a href="https://github.com/maillab/cloud-mail/stargazers" target="_blank">
            <img src="https://img.shields.io/github/stars/maillab/cloud-mail" alt="stargazers" />
        </a>  
        <a href="https://github.com/maillab/cloud-mail/forks" target="_blank" >
            <img src="https://img.shields.io/github/forks/maillab/cloud-mail" alt="forks" />
        </a>
    </p>
    <p align="center">
        <a href="https://trendshift.io/repositories/20459" target="_blank" >
            <img src="https://trendshift.io/api/badge/repositories/20459" alt="trendshift" >
        </a>
    </p>
</p>

## Giới thiệu
Chỉ với một tên miền, bạn có thể tạo nhiều địa chỉ email khác nhau tương tự các nền tảng email lớn. Dự án này có thể triển khai hoàn toàn trên Cloudflare Workers để tối ưu hóa chi phí máy chủ và xây dựng dịch vụ email riêng của bạn.

## Trưng bày dự án

- [Bản Demo trực tiếp](https://skymail.ink)<br>
- [Tài liệu hướng dẫn triển khai](https://doc.skymail.ink/en/)<br>

| ![](/doc/demo/demo1.png) | ![](/doc/demo/demo2.png) |
|--------------------------|--------------------------|
| ![](/doc/demo/demo3.png) | ![](/doc/demo/demo4.png) |

## Tính năng nổi bật

- **💰 Chi phí cực thấp**: Không cần máy chủ riêng — triển khai trên Cloudflare Workers giúp tiết kiệm tối đa chi phí.

- **💻 Giao diện Responsive**: Tự động thích ứng hoàn hảo cho cả máy tính và hầu hết các trình duyệt di động.

- **📧 Gửi Email**: Tích hợp Resend để gửi email, hỗ trợ gửi hàng loạt, nhúng ảnh và đính kèm tệp, theo dõi trạng thái gửi.

- **🛡️ Quản trị viên & Phân quyền**: Quản lý người dùng và danh sách email thông qua kiểm soát truy cập dựa trên vai trò (RBAC).

- **📦 Hỗ trợ Tệp đính kèm**: Nhận và gửi tệp đính kèm, lưu trữ và tải xuống thông qua bộ nhớ đối tượng Cloudflare R2.

- **🔔 Thông báo Email (Push)**: Chuyển tiếp email đã nhận tới Telegram Bot hoặc các nhà cung cấp email khác.

- **📡 API mở**: Hỗ trợ tạo người dùng hàng loạt qua API và truy vấn thư theo nhiều điều kiện.

- **🔢 Nhận diện Mã xác thực (OTP)**: Tự động phát hiện mã xác minh qua Workers AI.

- **📈 Trực quan hóa dữ liệu**: Sử dụng ECharts để hiển thị biểu đồ phân tích dữ liệu hệ thống, biểu đồ tăng trưởng người dùng & email.

- **🎨 Tùy chỉnh giao diện**: Tùy chỉnh tiêu đề trang web, hình nền đăng nhập và độ mờ giao diện.

- **🤖 Chống Bot/Spam**: Tích hợp Cloudflare Turnstile để ngăn chặn việc đăng ký tự động bằng bot.

- **📜 Nhiều tính năng khác**: Đang tiếp tục được phát triển...

## Ngăn xếp công nghệ (Tech Stack)

- **Nền tảng**: [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- **Web Framework**: [Hono](https://hono.dev/)
- **ORM**: [Drizzle](https://orm.drizzle.team/)
- **Frontend Framework**: [Vue3](https://vuejs.org/)
- **UI Framework**: [Element Plus](https://element-plus.org/)
- **Dịch vụ gửi thư**: [Resend](https://resend.com/)
- **Bộ nhớ đệm (Cache)**: [Cloudflare KV](https://developers.cloudflare.com/kv/)
- **Cơ sở dữ liệu**: [Cloudflare D1](https://developers.cloudflare.com/d1/)
- **Lưu trữ tệp tin**: [Cloudflare R2](https://developers.cloudflare.com/r2/)

## Cấu trúc thư mục dự án

```
cloud-mail
├── mail-worker				    # Dự án backend Cloudflare Worker
│   ├── src                  
│   │   ├── api	 			    # Lớp định tuyến API
│   │   ├── const  			    # Hằng số dự án
│   │   ├── dao                 # Lớp truy cập dữ liệu (Data Access Object)
│   │   ├── email			    # Xử lý và nhận email
│   │   ├── entity			    # Thực thể cơ sở dữ liệu (Database Entities)
│   │   ├── error			    # Xử lý ngoại lệ tùy chỉnh
│   │   ├── hono			    # Cấu hình Hono framework, middleware, xử lý lỗi
│   │   ├── i18n			    # Đa ngôn ngữ (i18n)
│   │   ├── init			    # Khởi tạo cơ sở dữ liệu và cache
│   │   ├── model			    # Mô hình dữ liệu phản hồi (Response Models)
│   │   ├── security			# Xác thực và phân quyền
│   │   ├── service			    # Lớp nghiệp vụ (Business Logic)
│   │   ├── template			# Bản mẫu thông báo / email
│   │   ├── utils			    # Các hàm tiện ích
│   │   └── index.js			# Điểm khởi chạy ứng dụng (Entry point)
│   ├── package.json			# Khai báo thư viện & dependencies
│   └── wrangler.toml			# Cấu hình dự án Cloudflare
│
├─ mail-vue				        # Dự án giao diện frontend Vue 3
│   ├── src
│   │   ├── axios 			    # Cấu hình Axios
│   │   ├── components			# Các component tái sử dụng
│   │   ├── echarts			    # Tích hợp biểu đồ ECharts
│   │   ├── i18n			    # Đa ngôn ngữ (i18n)
│   │   ├── init			    # Khởi tạo khi vào ứng dụng
│   │   ├── layout			    # Layout giao diện chính
│   │   ├── perm			    # Kiểm soát quyền hạn (Permissions)
│   │   ├── request			    # Lớp gọi API backend
│   │   ├── router			    # Cấu hình định tuyến Vue Router
│   │   ├── store			    # Quản lý trạng thái toàn cục (Pinia)
│   │   ├── utils			    # Các hàm tiện ích
│   │   ├── views			    # Các trang giao diện (Views)
│   │   ├── app.vue			    # Component gốc (Root)
│   │   ├── main.js			    # Điểm khởi chạy JS
│   │   └── style.css			# Stylesheet toàn cục
│   ├── package.json			# Khai báo thư viện & dependencies
└── └── env.release				# Cấu hình môi trường build
```

## Ủng hộ tác giả (Sponsor)

<a href="https://doc.skymail.ink/support.html">
<img width="170px" src="./doc/images/support.png" alt="">
</a>

## Giấy phép (License)

Dự án này được phân phối theo giấy phép [MIT](LICENSE).

## Kênh trao đổi & Hỗ trợ

[Telegram](https://t.me/cloud_mail_tg)
