# SmartFarm SEP490 - Student API Documentation

> Tài liệu này dành cho **Frontend** để tích hợp với các API dành cho role **Student**.
> Student là người học, có quyền hạn chế: xem thông tin, nhận và thực hiện task được giao.

---

## Mục lục

1. [Thông tin chung](#1-thông-tin-chung)
2. [Authentication](#2-authentication)
3. [Tasks (Tác vụ)](#3-tasks-tác-vụ)
4. [Task Reports (Báo cáo tác vụ)](#4-task-reports-báo-cáo-tác-vụ)
5. [Measurement Records (Ghi nhận đo lường)](#5-measurement-records-ghi-nhận-đo-lường)
6. [Experiments (Thí nghiệm - Read-only)](#6-experiments-thí-nghiệm---read-only)
7. [Farms & Crops (Thông tin công khai)](#7-farms--crops-thông-tin-công-khai)
8. [Notifications (Thông báo)](#8-notifications-thông-báo)
9. [Enums & Quy tắc chung](#9-enums--quy-tắc-chung)

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
  - `role`: `"Student"`

### Đặc điểm quyền của Student

| Chức năng | Quyền |
|-----------|--------|
| Xem Tasks của mình | ✅ |
| Bắt đầu/InProgress task | ✅ (chỉ task được giao) |
| Hoàn thành task | ✅ (chỉ task được giao) |
| Viết Task Report | ✅ (chỉ task được giao) |
| Ghi nhận đo lường | ✅ |
| Xem Experiments | ✅ (read-only) |
| Xem Farms | ✅ (read-only) |
| Xem Crops | ✅ (read-only) |
| Tạo/Sửa/Xóa task | ❌ |
| Gán task | ❌ |

> 💡 Student có quyền hạn chế tương tự Technician nhưng thường là người học trong quá trình thực tập/nghiên cứu.

---

## 2. Authentication

### 2.1 Login (Public)

```bash
curl -X POST "http://localhost:5038/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@smartfarm.com",
    "password": "your_password"
  }'
```

**Response 200 OK:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "email": "student@smartfarm.com",
  "role": "Student",
  "fullName": "Pham Van D"
}
```

### 2.2 Google Login (Public)

```bash
curl -X POST "http://localhost:5038/api/auth/google-login" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "google_id_token_from_frontend"
  }'
```

---

## 3. Tasks (Tác vụ)

> **Base Route**: `/api/tasks`
> **Lưu ý**: Student chỉ có thể xem và thao tác với task được **gán cho mình**.

### 3.1 Lấy Tasks của mình

> Endpoint quan trọng nhất cho Student - hiển thị công việc được giao.

```bash
curl -X GET "http://localhost:5038/api/tasks/my" \
  -H "Authorization: Bearer ${TOKEN}"
```

**Response 200 OK:**
```json
[
  {
    "id": "task-guid",
    "title": "Quan sát sự phát triển cây lúa",
    "description": "Quan sát và ghi chép chiều cao, số lá của 10 cây mẫu",
    "taskType": "Observation",
    "requiredSkillDescription": "Kỹ năng quan sát cơ bản",
    "dueDate": "2025-06-30T17:00:00Z",
    "status": "Pending",
    "experimentId": "...",
    "experimentTitle": "Thử nghiệm giống lúa ST25",
    "experimentStageId": "...",
    "experimentStageName": "Giai đoạn sinh trưởng",
    "batchId": "...",
    "batchCode": "BATCH001",
    "careScheduleId": null,
    "careScheduleTitle": null,
    "createdBy": "...",
    "createdByName": "Tran Thi B",
    "assignedTo": "...",
    "assignedToName": "Pham Van D",
    "assignments": [...],
    "skillRequirements": [...]
  }
]
```

### 3.2 Tasks hôm nay

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

```bash
curl -X PATCH "http://localhost:5038/api/tasks/{id}/start" \
  -H "Authorization: Bearer ${TOKEN}"
```

**Điều kiện:**
- Task phải có `status = "Pending"`
- User phải là assignee của task

### 3.7 Hoàn thành Task (InProgress -> Completed)

```bash
curl -X PATCH "http://localhost:5038/api/tasks/{id}/complete" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 3.8 Xem Assignments của mình

```bash
curl -X GET "http://localhost:5038/api/tasks/assignments/my" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 3.9 Xem Tasks theo Batch

```bash
curl -X GET "http://localhost:5038/api/tasks/batch/{batchId}" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 3.10 Xem Tasks theo Stage

```bash
curl -X GET "http://localhost:5038/api/tasks/stage/{stageId}" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## 4. Task Reports (Báo cáo tác vụ)

> **Base Route**: `/api/task-reports`
> **Auth**: Chỉ assignee mới được tạo report.

### 4.1 Tạo Task Report

> Sau khi hoàn thành task, Student tạo báo cáo kết quả học tập.

```bash
curl -X POST "http://localhost:5038/api/task-reports" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "task-guid",
    "reportText": "Đã hoàn thành quan sát 10 cây lúa mẫu. Chiều cao trung bình: 65cm, số lá trung bình: 8 lá/cây. Một số cây có biểu hiện sâu bệnh nhẹ ở lá già.",
    "resultData": {
      "plantsObserved": 10,
      "averageHeight": 65,
      "averageLeaves": 8,
      "pestFound": true,
      "pestDescription": "Sâu cuốn lá ở lá già"
    }
  }'
```

**Body Schema:**
| Field | Type | Required | Note |
|-------|------|----------|------|
| `taskId` | Guid | ✅ | Task được báo cáo |
| `reportText` | string | ✅ | Nội dung báo cáo |
| `resultData` | Dictionary | ❌ | Dữ liệu kết quả (key-value tự do) |

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
      "plantsObserved": 10,
      "averageHeight": 65.5
    }
  }'
```

---

## 5. Measurement Records (Ghi nhận đo lường)

> **Base Route**: `/api/measurement-records`
> **Đặc biệt**: Controller này **KHÔNG có role check** - bất kỳ authenticated user nào đều có thể ghi nhận.

### 5.1 Ghi nhận đo lường mới

> Student có thể ghi nhận dữ liệu thực địa khi thực hiện observation/inspection tasks.

```bash
curl -X POST "http://localhost:5038/api/measurement-records" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "experimentId": "exp-guid",
    "experimentStageId": "stage-guid",
    "batchId": "batch-guid",
    "measurementDefinitionId": "measurement-guid",
    "value": 65.5,
    "textValue": null,
    "extraData": {
      "plantNumber": 5,
      "note": "Cây mẫu số 5 trong lô"
    },
    "measuredAt": "2025-06-28T14:30:00Z"
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
| `measuredAt` | DateTime | ❌ | Thời điểm đo |

### 5.2 Xem lịch sử đo lường theo Batch

```bash
curl -X GET "http://localhost:5038/api/measurement-records/batch/{batchId}" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 5.3 Cập nhật Record

```bash
curl -X PUT "http://localhost:5038/api/measurement-records/{id}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "value": 66.0,
    "measuredAt": "2025-06-28T15:00:00Z"
  }'
```

### 5.4 Xóa Record

```bash
curl -X DELETE "http://localhost:5038/api/measurement-records/{id}" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## 6. Experiments (Thí nghiệm) - Read-only

> **Base Route**: `/api/experiments`
> **Auth**: Student có thể xem experiments (quyền hạn chế).

### 6.1 Lấy danh sách Experiments

> Student có thể xem experiments thuộc farm mà mình được phân công.

```bash
curl -X GET "http://localhost:5038/api/experiments" \
  -H "Authorization: Bearer ${TOKEN}"
```

**Lưu ý**: Quyền truy cập phụ thuộc vào cấu hình farm và user assignment.

### 6.2 Xem chi tiết Experiment

```bash
curl -X GET "http://localhost:5038/api/experiments/{id}" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 6.3 Xem Stages của Experiment

```bash
curl -X GET "http://localhost:5038/api/experiments/{experimentId}/stages" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 6.4 Xem Groups của Experiment

```bash
curl -X GET "http://localhost:5038/api/experiments/{experimentId}/groups" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 6.5 Xem Design của Experiment

```bash
curl -X GET "http://localhost:5038/api/experiments/{experimentId}/design" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 6.6 Xem Measurements của Experiment

```bash
curl -X GET "http://localhost:5038/api/experiments/{experimentId}/measurements" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 6.7 Xem Care Schedules

```bash
curl -X GET "http://localhost:5038/api/experiments/{experimentId}/schedules" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 6.8 Xem Procedure Templates

```bash
curl -X GET "http://localhost:5038/api/experiments/procedure-templates" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## 7. Farms & Crops (Thông tin công khai)

### 7.1 Xem danh sách Farms

> Xem thông tin farm để hiểu bối cảnh thí nghiệm.

```bash
curl -X GET "http://localhost:5038/api/farms" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 7.2 Xem chi tiết Farm

```bash
curl -X GET "http://localhost:5038/api/farms/{id}" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 7.3 Xem Areas của Farm

```bash
curl -X GET "http://localhost:5038/api/farms/farms/{farmId}/areas" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 7.4 Xem Beds của Area

```bash
curl -X GET "http://localhost:5038/api/farms/areas/{areaId}/beds" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 7.5 Xem danh sách Crops

```bash
curl -X GET "http://localhost:5038/api/crops" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 7.6 Xem chi tiết Crop

```bash
curl -X GET "http://localhost:5038/api/crops/{id}" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 7.7 Xem Crop Varieties

```bash
curl -X GET "http://localhost:5038/api/crops/crops/{cropId}/varieties" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 7.8 Xem chi tiết Variety

```bash
curl -X GET "http://localhost:5038/api/crops/varieties/{id}" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## 8. Notifications (Thông báo)

> **Base Route**: `/api/notifications`

### 8.1 Lấy thông báo của mình

```bash
curl -X GET "http://localhost:5038/api/notifications?pageNumber=1&pageSize=20" \
  -H "Authorization: Bearer ${TOKEN}"
```

**Response 200:**
```json
{
  "items": [
    {
      "id": "notif-guid",
      "recipientId": "...",
      "senderId": "...",
      "notificationType": "TaskAssignment",
      "title": "Bạn được giao công việc mới",
      "message": "Tran Thi B đã giao cho bạn task 'Quan sát sự phát triển cây lúa'",
      "priority": "Medium",
      "referenceTable": "Task",
      "referenceId": "task-guid",
      "isRead": false,
      "readAt": null,
      "createdAt": "2025-06-28T10:00:00Z"
    }
  ],
  "totalCount": 5,
  "pageNumber": 1,
  "pageSize": 20,
  "totalPages": 1
}
```

### 8.2 Đếm thông báo chưa đọc

```bash
curl -X GET "http://localhost:5038/api/notifications/unread-count" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 8.3 Đánh dấu đã đọc

```bash
curl -X PUT "http://localhost:5038/api/notifications/{id}/read" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 8.4 Đánh dấu tất cả đã đọc

```bash
curl -X PUT "http://localhost:5038/api/notifications/read-all" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## 9. Enums & Quy tắc chung

### 9.1 TaskStatus

```typescript
enum TaskStatus {
  Pending = 1,      // Chờ thực hiện
  InProgress = 2,  // Đang thực hiện
  Completed = 3,    // Hoàn thành
  Overdue = 4,      // Quá hạn
  Cancelled = 5     // Đã hủy
}
```

### 9.2 TaskType

```typescript
enum TaskType {
  Planting = 1,      // Trồng
  Watering = 2,     // Tưới nước
  Fertilizing = 3,   // Bón phân
  Observation = 4,   // Quan sát
  Inspection = 5,    // Kiểm tra
  Harvest = 6,      // Thu hoạch
  Other = 7          // Khác
}
```

### 9.3 Quy tắc cho Student

| Quy tắc | Chi tiết |
|---------|----------|
| **Task Assignment** | Chỉ thực hiện task khi được gán |
| **Start Task** | Chỉ `Pending` -> `InProgress` |
| **Complete Task** | Chỉ `InProgress` -> `Completed` |
| **Task Reports** | Chỉ assignee được tạo report |
| **Measurement Records** | Bất kỳ authenticated user nào đều có thể ghi nhận |
| **Xem Experiments** | Read-only, phụ thuộc vào farm assignment |
| **Xem Farms/Crops** | Read-only |

### 9.4 Date Format

- `DateOnly`: `yyyy-MM-dd` (ví dụ: `2025-06-28`)
- `DateTime`: ISO 8601 (ví dụ: `2025-06-28T14:30:00Z`)

---

## Phụ lục: Tổng hợp endpoints của Student

| Nhóm | Endpoint | Method | Quyền |
|------|----------|--------|--------|
| Auth | `/api/auth/login` | POST | Public |
| Auth | `/api/auth/google-login` | POST | Public |
| Task | `/api/tasks/my` | GET | Student |
| Task | `/api/tasks/today` | GET | Student |
| Task | `/api/tasks/upcoming` | GET | Student |
| Task | `/api/tasks/overdue` | GET | Student |
| Task | `/api/tasks/{id}` | GET | Student |
| Task | `/api/tasks/{id}/start` | PATCH | Assignee |
| Task | `/api/tasks/{id}/complete` | PATCH | Assignee |
| Task | `/api/tasks/assignments/my` | GET | Student |
| Task | `/api/tasks/stage/{id}` | GET | Student |
| Task | `/api/tasks/batch/{id}` | GET | Student |
| Report | `/api/task-reports` | POST | Assignee |
| Report | `/api/task-reports/task/{id}` | GET | Authenticated |
| Report | `/api/task-reports/batch/{id}` | GET | Authenticated |
| Report | `/api/task-reports/{id}` | PUT | Owner |
| Measurement | `/api/measurement-records` | POST | Authenticated |
| Measurement | `/api/measurement-records/batch/{id}` | GET | Authenticated |
| Measurement | `/api/measurement-records/{id}` | PUT, DELETE | Authenticated |
| Experiment | `/api/experiments` | GET | Read-only |
| Experiment | `/api/experiments/{id}` | GET | Read-only |
| Experiment | `/api/experiments/{id}/stages` | GET | Read-only |
| Experiment | `/api/experiments/{id}/groups` | GET | Read-only |
| Experiment | `/api/experiments/{id}/design` | GET | Read-only |
| Experiment | `/api/experiments/{id}/measurements` | GET | Read-only |
| Experiment | `/api/experiments/{id}/schedules` | GET | Read-only |
| Experiment | `/api/experiments/procedure-templates` | GET | Read-only |
| Farm | `/api/farms` | GET | Read-only |
| Farm | `/api/farms/{id}` | GET | Read-only |
| Farm | `/api/farms/farms/{id}/areas` | GET | Read-only |
| Farm | `/api/farms/areas/{id}/beds` | GET | Read-only |
| Crop | `/api/crops` | GET | Read-only |
| Crop | `/api/crops/{id}` | GET | Read-only |
| Crop | `/api/crops/crops/{id}/varieties` | GET | Read-only |
| Crop | `/api/crops/varieties/{id}` | GET | Read-only |
| Notification | `/api/notifications` | GET | Authenticated |
| Notification | `/api/notifications/unread-count` | GET | Authenticated |
| Notification | `/api/notifications/{id}/read` | PUT | Owner |
| Notification | `/api/notifications/read-all` | PUT | Authenticated |

---

## 📱 Gợi ý UI cho Student App

### Dashboard chính:
```
┌─────────────────────────────────────┐
│  Xin chào, Pham Van D!               │
│  Hôm nay: 28/06/2026                │
├─────────────────────────────────────┤
│  📋 Công việc của tôi                │
│  ├─ 🔴 Quá hạn: 1 task             │
│  ├─ 📝 Hôm nay: 3 task              │
│  └─ 📅 Sắp tới: 8 task             │
├─────────────────────────────────────┤
│  [Tasks hôm nay]                     │
│  ├─ ✅ Quan sát cây lúa - Đã xong   │
│  ├─ ⏳ Ghi nhận chiều cao - Đang làm│
│  └─ ⬜ Kiểm tra sâu bệnh - Chờ      │
├─────────────────────────────────────┤
│  [Thông báo] 🔴 2 chưa đọc          │
└─────────────────────────────────────┘
```

### Flow học tập:
```
1. Nhận notification về task mới
   → GET /api/notifications

2. Xem chi tiết công việc
   → GET /api/tasks/{id}

3. Bấm "Bắt đầu"
   → PATCH /api/tasks/{id}/start

4. Thực hiện quan sát/đo đạc
   → Ghi nhận dữ liệu (POST /api/measurement-records)

5. Bấm "Hoàn thành"
   → PATCH /api/tasks/{id}/complete

6. Viết báo cáo học tập
   → POST /api/task-reports

7. Xem lại kiến thức
   → GET /api/experiments/{id} (xem thiết kế experiment)
   → GET /api/experiments/procedure-templates (xem quy trình)
```

---

**Version**: 1.0  
**Ngày tạo**: 28/06/2026  
**Backend**: SmartFarm SEP490 (.NET 8 + JWT + EF Core)