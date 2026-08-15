# Skills, UserSkills & Task Count API — Curl Cookbook

Tài liệu này tổng hợp tất cả API mới thêm vào `SmartFarm_BE`:

- **Skills** (`/api/skills`) — `SkillsController`
- **UserSkills** (`/api/user-skills`, `/api/user-skills/skills/{id}/users`, `/api/user-skills/users/{id}/skills`) — `UserSkillsController`
- **Task Count** (`/api/tasks/count-by-user`)

> **Lưu ý kiến trúc:** Skills và UserSkills là 2 controller riêng biệt (trước đây gộp chung 1 controller; đã tách để FE/Backend dễ phân biệt và phân quyền độc lập).

## Mục lục

1. [Quy ước chung](#1-quy-ước-chung)
2. [Skills — CRUD](#2-skills--crud)
3. [UserSkills — CRUD](#3-userskills--crud)
4. [Task Count theo ngày](#4-task-count-theo-ngày)
5. [Error responses](#5-error-responses)

---

## 1. Quy ước chung

- **Base URL** (dev): `http://localhost:5038`
- **Auth**: Tất cả endpoint đều yêu cầu JWT Bearer token (trừ `POST /api/auth/login`).
  - Header: `Authorization: Bearer <accessToken>`
- **Phân quyền**:
  - `GET` Skills & UserSkills — mọi user đã đăng nhập (Technician, Student, Researcher, Admin).
  - `POST`, `PUT`, `DELETE` Skills & UserSkills — **chỉ Admin**.
  - `GET /api/tasks/count-by-user` — **chỉ Researcher**.
- **Format**: Request/Response dùng JSON. DateTime theo UTC. Skill/ProficiencyLevel dùng `int 1..10`.
- **Lấy token admin trước** (lưu vào biến shell để dùng lại):

```bash
# Đăng nhập Admin (email/password thật của bạn trong DB)
curl -X POST http://localhost:5038/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@smartfarm.local",
    "password": "Admin@123"
  }'
```

Response mẫu (200):

```json
{
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "...",
  "user": { "id": "...", "fullName": "Admin", "email": "admin@smartfarm.local", "role": "Admin" }
}
```

Lưu token:

```bash
# Bash / Git Bash
ADMIN_TOKEN="eyJhbGciOi..."

# PowerShell
$ADMIN_TOKEN = "eyJhbGciOi..."
```

---

## 2. Skills — CRUD

### 2.1. `GET /api/skills` — Lấy tất cả Skill

**Auth**: mọi user đã đăng nhập.

```bash
curl -X GET http://localhost:5038/api/skills \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Response 200**:

```json
[
  {
    "id": "8b1f6c5a-3d2e-4f51-9a01-7e9c6f4f2a01",
    "skillName": "Tưới nước",
    "description": "Kỹ năng tưới tiêu cho cây trồng",
    "createdAt": "2026-08-10T08:00:00Z",
    "totalUsers": 3,
    "totalTasks": 7
  },
  {
    "id": "8b1f6c5a-3d2e-4f51-9a01-7e9c6f4f2a02",
    "skillName": "Bón phân",
    "description": null,
    "createdAt": "2026-08-11T08:00:00Z",
    "totalUsers": 1,
    "totalTasks": 0
  }
]
```

### 2.2. `GET /api/skills/{id}` — Lấy 1 Skill

```bash
curl -X GET http://localhost:5038/api/skills/8b1f6c5a-3d2e-4f51-9a01-7e9c6f4f2a01 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Response 200**: như 1 phần tử trong array ở trên.
**Response 404**:

```json
{ "type": "https://tools.ietf.org/html/rfc9110#section-15.5.5", "title": "Not Found", "status": 404 }
```

### 2.3. `POST /api/skills` — Tạo Skill mới (Admin only)

```bash
curl -X POST http://localhost:5038/api/skills \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "skillName": "Quan sát sâu bệnh",
    "description": "Kỹ năng phát hiện dấu hiệu sâu bệnh trên lá cây"
  }'
```

**Response 201 Created** (trả về object Skill vừa tạo):

```json
{
  "id": "8b1f6c5a-3d2e-4f51-9a01-7e9c6f4f2a03",
  "skillName": "Quan sát sâu bệnh",
  "description": "Kỹ năng phát hiện dấu hiệu sâu bệnh trên lá cây",
  "createdAt": "2026-08-13T16:50:00Z",
  "totalUsers": 0,
  "totalTasks": 0
}
```

**Response 400** (trùng tên):

```json
{ "message": "Skill 'Quan sát sâu bệnh' da ton tai." }
```

### 2.4. `PUT /api/skills/{id}` — Cập nhật Skill (Admin only)

```bash
curl -X PUT http://localhost:5038/api/skills/8b1f6c5a-3d2e-4f51-9a01-7e9c6f4f2a03 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "skillName": "Quan sát sâu bệnh nâng cao",
    "description": "Đã cập nhật mô tả"
  }'
```

Field không gửi → giữ nguyên giá trị cũ.

**Response 200**:

```json
{
  "id": "8b1f6c5a-3d2e-4f51-9a01-7e9c6f4f2a03",
  "skillName": "Quan sát sâu bệnh nâng cao",
  "description": "Đã cập nhật mô tả",
  "createdAt": "2026-08-13T16:50:00Z",
  "totalUsers": 0,
  "totalTasks": 0
}
```

**Response 404**: skill không tồn tại.

### 2.5. `DELETE /api/skills/{id}` — Xóa Skill (Admin only)

```bash
curl -X DELETE http://localhost:5038/api/skills/8b1f6c5a-3d2e-4f51-9a01-7e9c6f4f2a03 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Response 204 No Content** — xóa thành công.
**Response 409 Conflict** (đang được tham chiếu):

```json
{ "message": "Khong the xoa Skill vi dang duoc su dung boi UserSkills hoac TaskSkillRequirements." }
```

---

## 3. UserSkills — CRUD

`UserSkill` là bảng nối giữa User ↔ Skill, có `ProficiencyLevel` (1..10).
Tất cả endpoint dưới đây thuộc **UserSkillsController** (route prefix `/api/user-skills`).

### 3.1. `GET /api/user-skills/users/{userId}` — Lấy skills của 1 user

```bash
curl -X GET http://localhost:5038/api/user-skills/users/c1d2e3f4-1111-2222-3333-444455556666 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Response 200**:

```json
[
  {
    "userId": "c1d2e3f4-1111-2222-3333-444455556666",
    "userName": "Nguyễn Văn A",
    "userEmail": "a.tech@smartfarm.local",
    "roleName": "Technician",
    "skillId": "8b1f6c5a-3d2e-4f51-9a01-7e9c6f4f2a01",
    "skillName": "Tưới nước",
    "proficiencyLevel": 7,
    "description": "Đã thực hành 2 mùa",
    "createdAt": "2026-07-15T10:00:00Z"
  }
]
```

### 3.2. `GET /api/user-skills/skills/{skillId}/users` — Lấy users có 1 skill

```bash
curl -X GET http://localhost:5038/api/user-skills/skills/8b1f6c5a-3d2e-4f51-9a01-7e9c6f4f2a01/users \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Response 200**: array tương tự trên, mỗi phần tử là 1 user sở hữu skill này.

### 3.3. `GET /api/user-skills` — Lấy tất cả UserSkills

```bash
curl -X GET http://localhost:5038/api/user-skills \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Response 200**: array UserSkill (mỗi phần tử như 3.1).

### 3.4. `GET /api/user-skills/{userId}/{skillId}` — Lấy 1 UserSkill

```bash
curl -X GET http://localhost:5038/api/user-skills/c1d2e3f4-1111-2222-3333-444455556666/8b1f6c5a-3d2e-4f51-9a01-7e9c6f4f2a01 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Response 200**: 1 object UserSkill.
**Response 404**: cặp (userId, skillId) không tồn tại.

### 3.5. `POST /api/user-skills` — Gán skill cho user (Admin only)

```bash
curl -X POST http://localhost:5038/api/user-skills \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "c1d2e3f4-1111-2222-3333-444455556666",
    "skillId": "8b1f6c5a-3d2e-4f51-9a01-7e9c6f4f2a02",
    "proficiencyLevel": 5,
    "description": "Đã hoàn thành khóa đào tạo nội bộ"
  }'
```

**Response 201 Created**: object UserSkill vừa tạo.
**Response 400** (lỗi validation hoặc đã tồn tại):

```json
{ "message": "User nay da co Skill nay roi (UserId+SkillId la khoa chinh)." }
```

### 3.6. `PUT /api/user-skills/{userId}/{skillId}` — Cập nhật UserSkill (Admin only)

```bash
curl -X PUT http://localhost:5038/api/user-skills/c1d2e3f4-1111-2222-3333-444455556666/8b1f6c5a-3d2e-4f51-9a01-7e9c6f4f2a02 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "proficiencyLevel": 8,
    "description": "Sau 6 tháng thực hành"
  }'
```

Field không gửi → giữ nguyên.

**Response 200**: object UserSkill sau update.
**Response 404**: không tìm thấy.

### 3.7. `DELETE /api/user-skills/{userId}/{skillId}` — Xóa UserSkill (Admin only)

```bash
curl -X DELETE http://localhost:5038/api/user-skills/c1d2e3f4-1111-2222-3333-444455556666/8b1f6c5a-3d2e-4f51-9a01-7e9c6f4f2a02 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Response 204 No Content** — xóa thành công.
**Response 404**: cặp (userId, skillId) không tồn tại.

---

## 4. Task Count theo ngày

API dành cho Admin xem số lượng task của mỗi Technician / Student trong một ngày cụ thể (giờ Việt Nam, ICT = UTC+7).

### Endpoint: `GET /api/tasks/count-by-user`

**Auth**: **Researcher only** (`[Authorize(Roles = "Researcher")]`).
Researcher cần endpoint này để xem số lượng task của mỗi Technician/Student nhằm phân công công việc hợp lý. Admin không có quyền truy cập endpoint này.

**Query params**:

| Tên | Bắt buộc | Kiểu | Mặc định | Mô tả |
|---|---|---|---|---|
| `date` | không | `DateOnly` (yyyy-MM-dd) | hôm nay ICT | Ngày cần đếm. FE có thể bỏ qua → mặc định là ngày hiện tại theo ICT. |
| `roles` | không | chuỗi CSV | `Technician,Student` | Danh sách role cần lọc, phân cách dấu phẩy. Không phân biệt hoa/thường. |

**Cửa sổ thời gian** (ICT → UTC):

- Nếu `date = 2026-08-13` → `[2026-08-13 00:00 ICT, 2026-08-14 00:00 ICT)`
- Tương đương UTC: `[2026-08-12T17:00:00Z, 2026-08-13T17:00:00Z)`

**Response 200**:

```json
{
  "date": "2026-08-13",
  "startUtc": "2026-08-12T17:00:00Z",
  "endUtc": "2026-08-13T17:00:00Z",
  "totalUsers": 2,
  "totalTasks": 8,
  "technicianTotal": 5,
  "studentTotal": 3,
  "users": [
    {
      "userId": "c1d2e3f4-1111-2222-3333-444455556666",
      "fullName": "Nguyễn Văn A",
      "email": "a.tech@smartfarm.local",
      "roleName": "Technician",
      "totalTasks": 5,
      "pendingTasks": 2,
      "inProgressTasks": 1,
      "completedTasks": 1,
      "overdueTasks": 1,
      "cancelledTasks": 0
    },
    {
      "userId": "c1d2e3f4-1111-2222-3333-444455556677",
      "fullName": "Trần Thị B",
      "email": "b.student@smartfarm.local",
      "roleName": "Student",
      "totalTasks": 3,
      "pendingTasks": 1,
      "inProgressTasks": 1,
      "completedTasks": 1,
      "overdueTasks": 0,
      "cancelledTasks": 0
    }
  ]
}
```

Giải thích field:
- `date` — ngày ICT đã xử lý.
- `startUtc` / `endUtc` — khoảng thời gian query trong DB (server lưu UTC).
- `users[]` — mỗi user có role nằm trong filter. Sắp xếp theo `roleName` rồi `fullName`.
- `totalUsers` — tổng số user trả về.
- `totalTasks` — tổng `totalTasks` của tất cả user.
- `technicianTotal` / `studentTotal` — tổng task gãy theo role.
- `*Tasks` của mỗi user — số task `DueDate` rơi vào cửa sổ `[startUtc, endUtc)` ứng với từng `Status`.

### 4.1. Đếm cho ngày hôm nay (mặc định)

```bash
curl -X GET "http://localhost:5038/api/tasks/count-by-user" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### 4.2. Đếm cho ngày chỉ định

```bash
curl -X GET "http://localhost:5038/api/tasks/count-by-user?date=2026-08-13" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### 4.3. Chỉ đếm cho 1 role cụ thể

```bash
# Chỉ Technician
curl -X GET "http://localhost:5038/api/tasks/count-by-user?date=2026-08-13&roles=Technician" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Chỉ Student
curl -X GET "http://localhost:5038/api/tasks/count-by-user?date=2026-08-13&roles=Student" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Nhiều role (thứ tự bất kỳ)
curl -X GET "http://localhost:5038/api/tasks/count-by-user?date=2026-08-13&roles=Student,Technician" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### 4.4. Response khi không có user thoả mãn

```json
{
  "date": "2026-08-13",
  "startUtc": "2026-08-12T17:00:00Z",
  "endUtc": "2026-08-13T17:00:00Z",
  "totalUsers": 0,
  "totalTasks": 0,
  "technicianTotal": 0,
  "studentTotal": 0,
  "users": []
}
```

### 4.5. Response khi date không hợp lệ (400)

```bash
curl -X GET "http://localhost:5038/api/tasks/count-by-user?date=khong-phai-ngay" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "One or more validation errors occurred.",
  "status": 400,
  "errors": {
    "date": ["The value 'khong-phai-ngay' is not valid."]
  }
}
```

---

## 5. Error responses

| Mã | Nguyên nhân | Ví dụ |
|---|---|---|
| `401 Unauthorized` | Thiếu / sai JWT | Quên header `Authorization`. |
| `403 Forbidden` | Không đủ quyền | Gọi `POST /api/skills` bằng token của Technician. |
| `404 Not Found` | Resource không tồn tại | `GET /api/skills/{guid-khong-ton-tai}`. |
| `400 Bad Request` | Validate lỗi hoặc business rule | Trùng SkillName, UserSkill đã tồn tại. |
| `409 Conflict` | Xung đột tham chiếu | Xóa Skill còn được dùng bởi UserSkill. |
| `500 Internal Server Error` | Lỗi server | DB không kết nối được, v.v. |

---

## 6. Tổng kết endpoints

| Method | Path | Auth |
|---|---|---|
| `GET`    | `/api/skills` | Auth |
| `GET`    | `/api/skills/{id}` | Auth |
| `POST`   | `/api/skills` | Admin |
| `PUT`    | `/api/skills/{id}` | Admin |
| `DELETE` | `/api/skills/{id}` | Admin |
| `GET`    | `/api/skills/user-skills` | Auth |
| `GET`    | `/api/skills/user-skills/{userId}/{skillId}` | Auth |
| `GET`    | `/api/skills/users/{userId}/skills` | Auth |
| `GET`    | `/api/skills/{skillId}/users` | Auth |
| `POST`   | `/api/skills/user-skills` | Admin |
| `PUT`    | `/api/skills/user-skills/{userId}/{skillId}` | Admin |
| `DELETE` | `/api/skills/user-skills/{userId}/{skillId}` | Admin |
| `GET /api/tasks/count-by-user` | Researcher |