# Hướng dẫn Deploy Smart Farm FE lên Vercel

## 1. Chuẩn bị

Project đã được cấu hình sẵn:
- `vercel.json` — framework `vite`, build command `npm run build`, output `dist`, SPA rewrite `/index.html`.
- `.env.example` — template biến môi trường (copy thành `.env.local` cho dev).
- `.vercelignore` — loại trừ `node_modules`, `dist`, `.env*`.
- `src/config.js` — đọc `VITE_API_BASE_URL` & `VITE_API_ORIGIN`, fallback về Azure backend.

## 2. Cách 1 — Deploy qua Vercel Dashboard (khuyến nghị)

1. Đẩy code lên GitHub (nếu chưa có):
   ```bash
   git init
   git add .
   git commit -m "chore: prepare for Vercel deploy"
   git branch -M main
   git remote add origin https://github.com/<user>/<repo>.git
   git push -u origin main
   ```
2. Vào https://vercel.com/new → **Import Git Repository** → chọn repo vừa push.
3. Vercel tự detect:
   - Framework Preset: **Vite**
   - Build Command: `npm run build` (mặc định)
   - Output Directory: `dist` (mặc định)
4. Mở **Environment Variables**, thêm:
   | Key | Value |
   | --- | --- |
   | `VITE_API_BASE_URL` | `https://smartfarm-sep490-api-c3emdvfmdefybacs.eastasia-01.azurewebsites.net/api` |
   | `VITE_API_ORIGIN` | `https://smartfarm-sep490-api-c3emdvfmdefybacs.eastasia-01.azurewebsites.net` |
   | `VITE_GOOGLE_CLIENT_ID` | (client ID Google OAuth của bạn, nếu có) |
   Áp dụng cho cả **Production**, **Preview**, **Development**.
5. Bấm **Deploy**. Sau ~1 phút bạn sẽ có URL dạng `https://smart-farm-sep490.vercel.app`.

## 3. Cách 2 — Deploy qua Vercel CLI

```bash
# Cài đặt 1 lần
npm i -g vercel

# Login
vercel login

# Deploy (chạy trong thư mục project)
vercel

# Trong quá trình hỏi:
#   - Set up and deploy? Y
#   - Which scope? <account của bạn>
#   - Link to existing project? N (hoặc Y nếu đã tạo)
#   - Project name: smart-farm-sep490
#   - In which directory is your code located? ./
#   - Override settings? N (đã có vercel.json)

# Sau khi mọi thứ OK, set env:
vercel env add VITE_API_BASE_URL production
#  (paste URL backend Azure)
vercel env add VITE_API_ORIGIN production
#  (paste origin backend Azure)

# Deploy production
vercel --prod
```

## 4. CORS

Sau khi deploy, backend Azure cần whitelist domain FE (ví dụ `https://smart-farm-sep490.vercel.app`) trong cấu hình CORS. Nếu backend dùng AllowAny thì không cần.

## 5. Build test local

```bash
npm run build
npm run preview
```

Nếu mở `http://localhost:4173` thấy FE chạy OK + gọi API về Azure được thì deploy sẽ thành công.
