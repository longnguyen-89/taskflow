# TaskFlow — App Giao Việc & Theo Dõi Tiến Độ

App quản lý công việc cho team 5-15 người. Giám đốc giao task, theo dõi tiến độ realtime. Nhân viên nhận việc, cập nhật trạng thái, đề xuất task mới.

## Tính năng

### Giám đốc (Admin)
- Dashboard tổng quan: tổng task, đang làm, hoàn thành, trễ hạn
- Danh sách task theo từng nhân viên với thanh tiến độ
- Giao task mới trực tiếp
- Đánh giá hiệu quả nhân sự theo tuần/tháng/quý (xếp hạng A+ → D)
- Duyệt/từ chối task do nhân viên đề xuất

### Nhân viên (Member)
- Xem task được giao, sắp theo deadline
- Cập nhật trạng thái: Chưa làm → Đang làm → Hoàn thành
- Ghi chú cho giám đốc
- Tự tạo task mới (cần giám đốc duyệt)
- Nhận thông báo khi có task mới, task được duyệt/từ chối

### Chung
- Realtime: thay đổi hiển thị ngay không cần refresh
- Mobile-friendly: dùng trên điện thoại mượt mà
- PWA: có thể "Add to Home Screen" như app native

## Tech Stack
- **Frontend**: Next.js 14 + Tailwind CSS
- **Backend/DB**: Supabase (PostgreSQL + Realtime + Auth)
- **Deploy**: Vercel + GitHub

---

## HƯỚNG DẪN DEPLOY TỪNG BƯỚC

### Bước 1: Tạo tài khoản Supabase (Database)

1. Vào **https://supabase.com** → Sign Up (dùng GitHub hoặc email)
2. Bấm **"New Project"**
3. Điền:
   - **Name**: `taskflow`
   - **Database Password**: tạo mật khẩu mạnh (lưu lại)
   - **Region**: chọn `Southeast Asia (Singapore)` cho nhanh
4. Bấm **"Create new project"** → đợi 1-2 phút

### Bước 2: Setup Database

1. Trong Supabase dashboard, bấm **"SQL Editor"** ở menu trái
2. Bấm **"New query"**
3. Copy TOÀN BỘ nội dung file **`supabase-setup.sql`** vào editor
4. Bấm **"Run"** → chờ chạy xong, thấy "Success" là OK

### Bước 3: Lấy API Keys

1. Trong Supabase, vào **Settings** (icon bánh răng) → **API**
2. Copy 2 giá trị:
   - **Project URL**: dạng `https://xxxxx.supabase.co`
   - **anon public key**: chuỗi dài bắt đầu bằng `eyJ...`
3. Lưu lại, sẽ dùng ở bước sau

### Bước 4: Tắt email confirm (cho dễ test)

1. Trong Supabase, vào **Authentication** → **Providers** → **Email**
2. Tắt **"Confirm email"** → Save
3. (Khi chạy production thật thì bật lại)

### Bước 5: Push code lên GitHub

1. Vào **https://github.com** → đăng nhập
2. Bấm **"New repository"** → đặt tên `taskflow` → **Create**
3. Mở Terminal trên máy tính, chạy lần lượt:

```bash
# Clone hoặc copy thư mục taskflow vào máy
cd taskflow

# Tạo file .env.local (thay bằng key thật từ bước 3)
cp .env.local.example .env.local
# Mở .env.local và điền:
# NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...

# Push lên GitHub
git init
git add .
git commit -m "Initial commit - TaskFlow app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/taskflow.git
git push -u origin main
```

### Bước 6: Deploy lên Vercel

1. Vào **https://vercel.com** → đăng nhập bằng GitHub
2. Bấm **"Add New..."** → **"Project"**
3. Tìm repo **taskflow** → bấm **"Import"**
4. Ở phần **Environment Variables**, thêm 2 biến:
   - `NEXT_PUBLIC_SUPABASE_URL` = URL từ bước 3
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Key từ bước 3
5. Bấm **"Deploy"** → đợi 1-2 phút
6. Vercel sẽ cho bạn link dạng: `https://taskflow-xxx.vercel.app`

### Bước 7: Bắt đầu sử dụng

1. Mở link Vercel → **Tạo tài khoản Giám đốc** (chọn vai trò "Giám đốc")
2. Gửi link cho nhân viên → họ tạo tài khoản "Nhân viên"
3. Đăng nhập giám đốc → bắt đầu giao task!

---

## Chạy trên máy local (để test)

```bash
cd taskflow
npm install
npm run dev
```
Mở http://localhost:3000

---

## Cấu trúc thư mục

```
taskflow/
├── public/
│   └── manifest.json          # PWA config
├── src/
│   ├── components/
│   │   ├── ApprovalQueue.js   # Hàng đợi duyệt task
│   │   ├── CreateTask.js      # Form tạo task
│   │   ├── Notifications.js   # Thông báo
│   │   ├── Performance.js     # Đánh giá nhân sự
│   │   ├── TaskList.js        # Danh sách task
│   │   └── Toaster.js         # Toast notifications
│   ├── contexts/
│   │   └── AuthContext.js     # Quản lý đăng nhập
│   ├── lib/
│   │   └── supabase.js        # Supabase client
│   ├── pages/
│   │   ├── _app.js
│   │   ├── _document.js
│   │   ├── dashboard.js       # Trang chính
│   │   └── index.js           # Trang đăng nhập
│   └── styles/
│       └── globals.css
├── supabase-setup.sql         # SQL tạo database
├── .env.local.example         # Template biến môi trường
├── next.config.js
├── tailwind.config.js
└── package.json
```
