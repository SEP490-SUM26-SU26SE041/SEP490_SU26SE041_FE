# SmartFarm SEP490 - Technician API Documentation

> Tài liệu này dành cho **Frontend** để tích hợp với các API dành cho role **Technician**.
> Technician là người thực hiện các tác vụ thực địa: tưới nước, bón phân, kiểm tra, thu hoạch.

---

## Mục lục

1. [Thông tin chung](#1-thông-tin-chung)
2. [Authentication](#2-authentication)
3. [Tasks (Tác vụ - phần Technician)](#3-tasks-tác-vụ---phần-technician)
4. [Task Reports (Báo cáo tác vụ)](#4-task-reports-báo-cáo-tác-vụ)
5. [Task Images (Hình ảnh)](#5-task-images-hình-ảnh)
6. [Measurement Records (Ghi nhận đo lường)](#6-measurement-records-ghi-nhận-đo-lường)
7. [Notifications (Thông báo)](#7-notifications-thông-báo)
8. [Enums & Quy tắc chung](#8-enums--quy-tắc-chung)

---

## 1. Thông tin chung

### Base URL

| Môi trường | URL |
|------------|-----|
| HTTP (dev) | `http://localhost:5038` |
| HTTPS (dev) | `https://localhost:7048` |
| Swagger UI | `<base>/swagger` |

### Authentication Scheme

- **Scheme**: JWT Bearer Token
- **Header**: `Authorization: Bearer <token>`
- **Claims trong token**:
  - `sub`: User ID (Guid)
  - `role`: `"Technician"`

### Đặc điểm quyền của Technician

| Chức năng | Quyền |
|-----------|--------|
| Xem Tasks của mình | ✅ |
| Bắt đầu/InProgress task | ✅ (chỉ task được giao) |
| Hoàn thành task | ✅ (chỉ task được giao) |
| Viết Task Report | ✅ (chỉ task được giao) |
| Upload hình ảnh | ✅ |
| Ghi nhận đo lường | ✅ |
| Tạo/Sửa/Xóa task | ❌ |
| Gán task | ❌ |
| Xem Experiments | ✅ (read-only, qua farm access) |
| Xem Farms | ✅ (read-only) |

---

## 2. Authentication

### 2.1 Login (Public)

```bash
curl -X POST "http://localhost:5038/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "technician@smartfarm.com",
    "password": "your_password"
  }'
```

**Response 200 OK:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "email": "technician@smartfarm.com",
  "role": "Technician",
  "fullName": "Le Van C"
}
```

---

## 3. Tasks (Tác vụ) - Phần Technician

> **Base Route**: `/api/tasks`
> **Lưu ý quan trọng**: Technician chỉ có thể thao tác với task được **gán cho mình**.

### 3.1 Lấy Tasks của mình

> Đây là endpoint quan trọng nhất cho Technician - hiển thị dashboard.

```bash
curl -X GET "http://localhost:5038/api/tasks/my" \
  -H "Authorization: Bearer ${TOKEN}"
```

**Response 200 OK:**
```json
[
  {
    "id": "task-guid",
    "title": "Tưới nước ngày 28/06",
    "description": "Tưới 2 lít/m² cho khu A1",
    "taskType": "Watering",
    "requiredSkillDescription": "Vận hành hệ thống tưới tự động",
    "dueDate": "2025-06-28T09:00:00Z",
    "status": "Pending",
    "experimentId": "...",
    "experimentTitle": "Thử nghiệm giống lúa ST25",
    "experimentStageId": "...",
    "experimentStageName": "Giai đoạn sinh trưởng",
    "batchId": "...",
    "batchCode": "BATCH001",
    "careScheduleId": "...",
    "careScheduleTitle": "Tưới nước buổi sáng",
    "createdBy": "...",
    "createdByName": "Tran Thi B",
    "assignedTo": "...",
    "assignedToName": "Le Van C",
    "assignments": [...],
    "skillRequirements": [...]
  }
]
```

### 3.2 Tasks hôm nay

> Dùng cho mobile app - hiển thị công việc cần làm hôm nay.

```bash
curl -X GET "http://localhost:5038/api/tasks/today" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 3.3 Tasks sắp tới

```bash
# Mặc định 7 ngày
curl -X GET "http://localhost:5038/api/tasks/upcoming" \
  -H "Authorization: Bearer ${TOKEN}"

# Tùy chỉnh số ngày
curl -X GET "http://localhost:5038/api/tasks/upcoming?days=14" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 3.4 Tasks quá hạn

```bash
curl -X GET "http://localhost:5038/api/tasks/overdue" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 3.5 Xem chi tiết Task

```bash
curl -X GET "http://localhost:5038/api/tasks/{id}" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 3.6 Bắt đầu thực hiện Task (Pending -> InProgress)

> Khi Technician bấm "Bắt đầu" trên app.

```bash
curl -X PATCH "http://localhost:5038/api/tasks/{id}/start" \
  -H "Authorization: Bearer ${TOKEN}"
```

**Điều kiện:**
- Task phải có `status = "Pending"`
- User phải là assignee của task

**Response 200 OK:** Trả về `TaskResponseDto` với `status = "InProgress"`

### 3.7 Hoàn thành Task (InProgress -> Completed)

> Khi Technician hoàn thành công việc.

```bash
curl -X PATCH "http://localhost:5038/api/tasks/{id}/complete" \
  -H "Authorization: Bearer ${TOKEN}"
```

**Điều kiện:**
- Task phải có `status = "InProgress"`
- User phải là assignee

**Response 200 OK:** Trả về `TaskResponseDto` với `status = "Completed"`

### 3.8 Xem Assignments của mình

```bash
curl -X GET "http://localhost:5038/api/tasks/assignments/my" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## 4. Task Reports (Báo cáo tác vụ)

> **Base Route**: `/api/task-reports`
> **Auth**: Chỉ assignee mới được tạo report.

### 4.1 Tạo Task Report

> Khi hoàn thành task, Technician tạo báo cáo kết quả.

```bash
curl -X POST "http://localhost:5038/api/task-reports" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "task-guid",
    "reportText": "Đã hoàn thành tưới nước cho khu A1 (10 lô). Lượng nước tưới 2.5 lít/m². Hệ thống tưới hoạt động bình thường.",
    "resultData": {
      "waterUsed": 500,
      "duration": 45,
      "weatherCondition": "Nắng nhẹ",
      "temperature": 28.5,
      "humidity": 75
    }
  }'
```

**Body Schema:**
| Field | Type | Required | Note |
|-------|------|----------|------|
| `taskId` | Guid | ✅ | Task được báo cáo |
| `reportText` | string | ✅ | Nội dung báo cáo |
| `resultData` | Dictionary | ❌ | Dữ liệu kết quả (key-value tự do) |

**resultData có thể chứa:**
```json
{
  "waterUsed": 500,
  "fertilizerUsed": "10kg NPK",
  "pestFound": "Rầy nâu",
  "photosTaken": 5,
  "notes": "Cây phát triển tốt"
}
```

**Response 201 Created:** Trả về `TaskReportResponseDto`

### 4.2 Xem Reports theo Task

```bash
curl -X GET "http://localhost:5038/api/task-reports/task/{taskId}" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 4.3 Xem Reports theo Batch

```bash
curl -X GET "http://localhost:5038/api/task-reports/batch/{batchId}" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 4.4 Cập nhật Report (chỉ người tạo)

```bash
curl -X PUT "http://localhost:5038/api/task-reports/{reportId}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "reportText": "Cập nhật báo cáo sau khi bổ sung thông tin...",
    "resultData": {
      "waterUsed": 520
    }
  }'
```

---

## 5. Task Images (Hình ảnh)

> **Base Route**: `/api/task-images`

### 5.1 Upload hình ảnh Task

```bash
curl -X POST "http://localhost:5038/api/task-images/upload" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "experimentId": "exp-guid",
    "batchId": "batch-guid",
    "taskReportId": "report-guid",
    "imageUrl": "https://storage.example.com/images/task123.jpg",
    "caption": "Hình ảnh cây lúa sau khi tưới",
    "capturedAt": "2025-06-28T10:30:00Z"
  }'
```

**Body Schema:**
| Field | Type | Required | Note |
|-------|------|----------|------|
| `experimentId` | Guid | ✅ | Experiment liên quan |
| `batchId` | Guid | ❌ | Batch cụ thể |
| `taskReportId` | Guid | ❌ | Report liên quan |
| `imageUrl` | string | ✅ | URL ảnh (sau khi upload lên storage) |
| `caption` | string | ❌ | Mô tả ảnh |
| `capturedAt` | DateTime | ❌ | Thời điểm chụp |

### 5.2 Lấy hình ảnh theo Task Report

```bash
curl -X GET "http://localhost:5038/api/task-images/task/{taskReportId}" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 5.3 Lấy hình ảnh theo Batch

```bash
curl -X GET "http://localhost:5038/api/task-images/batch/{batchId}" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 5.4 Xóa hình ảnh

```bash
curl -X DELETE "http://localhost:5038/api/task-images/{imageId}" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## 6. Measurement Records (Ghi nhận đo lường)

> **Base Route**: `/api/measurement-records`
> **Đặc biệt**: Controller này **KHÔNG có role check** - bất kỳ authenticated user nào đều có thể ghi nhận.

### 6.1 Ghi nhận đo lường mới

> Dùng cho việc đo đạc thực địa: chiều cao cây, pH đất, độ ẩm...

```bash
curl -X POST "http://localhost:5038/api/measurement-records" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "experimentId": "exp-guid",
    "experimentStageId": "stage-guid",
    "batchId": "batch-guid",
    "measurementDefinitionId": "measurement-guid",
    "value": 75.5,
    "textValue": null,
    "extraData": {
      "location": "Khu A1 - Lô 3",
      "plantNumber": 15,
      "note": "Cây số 15 trong lô"
    },
    "measuredAt": "2025-06-28T10:30:00Z"
  }'
```

**Body Schema:**
| Field | Type | Required | Note |
|-------|------|----------|------|
| `experimentId` | Guid | ✅ | Experiment |
| `experimentStageId` | Guid | ❌ | Giai đoạn |
| `batchId` | Guid | ✅ | Batch |
| `measurementDefinitionId` | Guid | ❌ | Định nghĩa metric |
| `value` | decimal | ❌ | Giá trị số |
| `textValue` | string | ❌ | Giá trị text (thay thế cho value) |
| `extraData` | Dictionary | ❌ | Dữ liệu bổ sung |
| `measuredAt` | DateTime | ❌ | Thời điểm đo (mặc định: now) |

> 💡 Có thể ghi nhận bằng `textValue` thay vì `value` nếu không phải số.

### 6.2 Xem lịch sử đo lường theo Batch

```bash
curl -X GET "http://localhost:5038/api/measurement-records/batch/{batchId}" \
  -H "Authorization: Bearer ${TOKEN}"
```

**Response 200:**
```json
[
  {
    "id": "record-guid",
    "experimentId": "...",
    "experimentTitle": "Thử nghiệm giống lúa ST25",
    "experimentStageId": "...",
    "experimentStageName": "Giai đoạn sinh trưởng",
    "batchId": "...",
    "batchCode": "BATCH001",
    "measurementDefinitionId": "...",
    "metricName": "Chiều cao cây",
    "unit": "cm",
    "targetValue": 80.0,
    "value": 75.5,
    "textValue": null,
    "extraData": {
      "location": "Khu A1 - Lô 3",
      "plantNumber": 15
    },
    "measuredBy": "...",
    "measuredByName": "Le Van C",
    "measuredAt": "2025-06-28T10:30:00Z"
  }
]
```

### 6.3 Cập nhật Record

```bash
curl -X PUT "http://localhost:5038/api/measurement-records/{id}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "value": 76.0,
    "measuredAt": "2025-06-28T11:00:00Z"
  }'
```

### 6.4 Xóa Record

```bash
curl -X DELETE "http://localhost:5038/api/measurement-records/{id}" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## 7. Notifications (Thông báo)

> **Base Route**: `/api/notifications`

### 7.1 Lấy thông báo của mình

```bash
curl -X GET "http://localhost:5038/api/notifications?pageNumber=1&pageSize=20" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 7.2 Đếm thông báo chưa đọc

> 💡 Gợi ý: Poll mỗi 30-60s cho badge app.

```bash
curl -X GET "http://localhost:5038/api/notifications/unread-count" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 7.3 Đánh dấu đã đọc

```bash
curl -X PUT "http://localhost:5038/api/notifications/{id}/read" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 7.4 Đánh dấu tất cả đã đọc

```bash
curl -X PUT "http://localhost:5038/api/notifications/read-all" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## 8. Enums & Quy tắc chung

### 8.1 TaskStatus

```typescript
enum TaskStatus {
  Pending = 1,      // Chờ thực hiện
  InProgress = 2,  // Đang thực hiện
  Completed = 3,    // Hoàn thành
  Overdue = 4,      // Quá hạn
  Cancelled = 5     // Đã hủy
}
```

### 8.2 TaskType

```typescript
enum TaskType {
  Planting = 1,      // Trồng
  Watering = 2,     // Tưới nước
  Fertilizing = 3,   // Bón phân
  Observation = 4,   // Quan sát
  Inspection = 5,    // Kiểm tra
  Harvest = 6,       // Thu hoạch
  Other = 7          // Khác
}
```

### 8.3 TaskAssignmentStatus

```typescript
enum TaskAssignmentStatus {
  Assigned = 1,     // Đã gán
  Reassigned = 2,   // Chuyển giao
  Resigned = 3,     // Từ chối
  Completed = 4,     // Hoàn thành
  Cancelled = 5     // Hủy
}
```

### 8.4 Quy tắc cho Technician

| Quy tắc | Chi tiết |
|---------|----------|
| **Task Assignment** | Chỉ thực hiện task khi được gán (`assignedTo == userId`) |
| **Start Task** | Chỉ `Pending` -> `InProgress` được |
| **Complete Task** | Chỉ `InProgress` -> `Completed` được |
| **Task Reports** | Chỉ assignee mới được tạo report cho task |
| **Measurement Records** | Bất kỳ authenticated user nào đều có thể ghi nhận |

### 8.5 Date Format

- `DateOnly`: `yyyy-MM-dd` (ví dụ: `2025-06-28`)
- `DateTime`: ISO 8601 (ví dụ: `2025-06-28T10:30:00Z`)

---

## Phụ lục: Tổng hợp endpoints của Technician

| Nhóm | Endpoint | Method | Quyền |
|------|----------|--------|--------|
| Auth | `/api/auth/login` | POST | Public |
| Task | `/api/tasks/my` | GET | Technician |
| Task | `/api/tasks/today` | GET | Technician |
| Task | `/api/tasks/upcoming` | GET | Technician |
| Task | `/api/tasks/overdue` | GET | Technician |
| Task | `/api/tasks/{id}` | GET | Technician |
| Task | `/api/tasks/{id}/start` | PATCH | Assignee |
| Task | `/api/tasks/{id}/complete` | PATCH | Assignee |
| Task | `/api/tasks/assignments/my` | GET | Technician |
| Task | `/api/tasks/stage/{id}` | GET | Technician |
| Task | `/api/tasks/batch/{id}` | GET | Technician |
| Report | `/api/task-reports` | POST | Assignee |
| Report | `/api/task-reports/task/{id}` | GET | Authenticated |
| Report | `/api/task-reports/batch/{id}` | GET | Authenticated |
| Report | `/api/task-reports/{id}` | PUT | Owner |
| Image | `/api/task-images/upload` | POST | Authenticated |
| Image | `/api/task-images/task/{id}` | GET | Authenticated |
| Image | `/api/task-images/batch/{id}` | GET | Authenticated |
| Image | `/api/task-images/{id}` | DELETE | Owner |
| Measurement | `/api/measurement-records` | POST | Authenticated |
| Measurement | `/api/measurement-records/batch/{id}` | GET | Authenticated |
| Measurement | `/api/measurement-records/{id}` | PUT, DELETE | Authenticated |
| Notification | `/api/notifications` | GET | Authenticated |
| Notification | `/api/notifications/unread-count` | GET | Authenticated |
| Notification | `/api/notifications/{id}/read` | PUT | Owner |
| Notification | `/api/notifications/read-all` | PUT | Authenticated |

---

## 📱 Gợi ý UI cho Technician App

### Dashboard chính:
```
┌─────────────────────────────────┐
│  Xin chào, Le Van C!            │
│  Hôm nay: 28/06/2026            │
├─────────────────────────────────┤
│  🔴 Quá hạn: 2 task            │
│  📋 Hôm nay: 5 task             │
│  📅 Sắp tới (7 ngày): 12 task  │
├─────────────────────────────────┤
│  [Tasks hôm nay]                 │
│  ├─ ✅ Tưới nước khu A1         │
│  ├─ ⏳ Bón phân khu B2          │
│  └─ ⬜ Kiểm tra sâu bệnh khu C3 │
├─────────────────────────────────┤
│  [Notifications] 🔴 3 chưa đọc   │
└─────────────────────────────────┘
```

### Flow xử lý Task:
```
1. Nhận task (từ notification)
   → GET /api/tasks/today

2. Bấm "Bắt đầu"
   → PATCH /api/tasks/{id}/start

3. Thực hiện công việc
   → Đo đạc (POST /api/measurement-records)
   → Chụp ảnh (POST /api/task-images/upload)

4. Bấm "Hoàn thành"
   → PATCH /api/tasks/{id}/complete

5. Viết báo cáo
   → POST /api/task-reports
```

---

**Version**: 1.0  
**Ngày tạo**: 28/06/2026  
**Backend**: SmartFarm SEP490 (.NET 8 + JWT + EF Core)