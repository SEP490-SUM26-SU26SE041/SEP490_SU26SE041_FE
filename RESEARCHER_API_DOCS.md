# SmartFarm SEP490 - Researcher API Documentation

> Tài liệu này dành cho **Frontend** để tích hợp với các API dành cho role **Researcher**.
> Toàn bộ endpoint yêu cầu JWT Bearer Token trừ `Auth/*` (public).

---

## Mục lục

1. [Thông tin chung](#1-thông-tin-chung)
2. [Authentication](#2-authentication)
3. [Quy trình làm việc của Researcher](#3-quy-trình-làm-việc-của-researcher)
4. [Experiment Requests (Gửi yêu cầu thí nghiệm)](#4-experiment-requests-gửi-yêu-cầu-thí-nghiệm)
5. [Experiments (Thí nghiệm)](#5-experiments-thí-nghiệm)
6. [Experiment Stages (Giai đoạn)](#6-experiment-stages-giai-đoạn)
7. [Experiment Groups (Nhóm)](#7-experiment-groups-nhóm)
8. [Experiment Design (Thiết kế)](#8-experiment-design-thiết-kế)
9. [Measurement Definitions (Định nghĩa đo lường)](#9-measurement-definitions-định-nghĩa-đo-lường)
10. [Procedure Templates (Mẫu quy trình)](#10-procedure-templates-mẫu-quy-trình)
11. [Care Schedules (Lịch chăm sóc)](#11-care-schedules-lịch-chăm-sóc)
12. [Tasks (Tác vụ)](#12-tasks-tác-vụ)
13. [Task Reports (Báo cáo tác vụ)](#13-task-reports-báo-cáo-tác-vụ)
14. [Batches (Lô)](#14-batches-lô)
15. [Measurement Records (Ghi nhận đo lường)](#15-measurement-records-ghi-nhận-đo-lường)
16. [Enums & Quy tắc chung](#16-enums--quy-tắc-chung)

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
  - `role`: `"Researcher"` (hoặc `"Manager"`, `"Student"`, `"Admin"`)

### Response Format

ExperimentsController trả về `ApiResponse<T>`:
```json
{
  "success": true,
  "message": "Thanh cong",
  "data": { ... }
}
```

ExperimentRequestsController trả về nhiều format khác nhau (xem từng endpoint).

---

## 2. Authentication

### 2.1 Login (Public)

```bash
curl -X POST "http://localhost:5038/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "researcher@smartfarm.com",
    "password": "your_password"
  }'
```

**Response 200 OK:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "email": "researcher@smartfarm.com",
  "role": "Researcher",
  "fullName": "Tran Thi B"
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

### 2.3 Forgot Password (Public)

```bash
curl -X POST "http://localhost:5038/api/auth/forgot-password" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "researcher@smartfarm.com"
  }'
```

**Response 200 OK:**
```json
{ "message": "Mã xác nhận đã được gửi về Email" }
```

### 2.4 Verify Code (Public)

```bash
curl -X POST "http://localhost:5038/api/auth/verify-code" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "researcher@smartfarm.com",
    "code": "123456"
  }'
```

### 2.5 Reset Password (Public)

```bash
curl -X POST "http://localhost:5038/api/auth/reset-password" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "researcher@smartfarm.com",
    "code": "123456",
    "newPassword": "new_password_123"
  }'
```

---

## 3. Quy trình làm việc của Researcher

```
1. Gửi Experiment Request (chờ Manager duyệt)
   → POST /api/experiment-requests

2. Chờ Manager duyệt (kiểm tra status)
   → GET /api/experiment-requests/{id}

3. Khi được duyệt → Tạo Experiment từ Request
   → POST /api/experiments/from-request/{requestId}

4. Thiết kế Experiment (có thể tạo mới nếu không dùng request)
   → POST /api/experiments

5. Thêm Stages, Groups, Design, Measurements
   → POST /api/experiments/{id}/stages
   → POST /api/experiments/{id}/groups
   → POST /api/experiments/{id}/design
   → POST /api/experiments/{id}/measurements

6. Tạo Care Schedules
   → POST /api/experiments/{id}/schedules

7. Tạo Batches
   → POST /api/batches

8. Tạo Tasks (thủ công hoặc auto-generate)
   → POST /api/tasks/generate-by-experiment/{experimentId}
   → POST /api/tasks

9. Gán Tasks cho Technician/Student
   → POST /api/tasks/assign
```

---

## 4. Experiment Requests (Gửi yêu cầu thí nghiệm)

> **Base Route**: `/api/experiment-requests`
> **Auth**: Researcher gửi yêu cầu đến farm có Manager.

### 4.1 Tạo Experiment Request (Gửi yêu cầu)

```bash
curl -X POST "http://localhost:5038/api/experiment-requests" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "farmId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "cropVarietyId": "b0d4f2a1-8c9e-4b5d-9f2c-1a3e5b7d9f0",
    "procedureTemplateId": "c1e5g3b2-9d0f-5c6a-0g3d-2b4f6c8e1a2",
    "title": "Thử nghiệm giống lúa ST25 mùa đông",
    "objective": "Đánh giá năng suất và chất lượng gạo của giống lúa ST25 trong điều kiện canh tác mùa đông tại Bắc Giang",
    "expectedStartDate": "2025-11-01",
    "expectedEndDate": "2026-04-30",
    "monitoringPlan": "Đo chiều cao cây, số bông, số hạt mỗi bông, năng suất/ha"
  }'
```

**Body Schema:**
| Field | Type | Required | Note |
|-------|------|----------|------|
| `farmId` | Guid | ✅ | Farm gửi đến (phải có Manager) |
| `cropVarietyId` | Guid | ❌ | Giống cây trồng |
| `procedureTemplateId` | Guid | ❌ | Mẫu quy trình có sẵn |
| `title` | string | ✅ | Tiêu đề yêu cầu |
| `objective` | string | ✅ | Mục tiêu thí nghiệm |
| `expectedStartDate` | DateOnly | ❌ | Ngày bắt đầu dự kiến |
| `expectedEndDate` | DateOnly | ❌ | Ngày kết thúc dự kiến |
| `monitoringPlan` | string | ❌ | Kế hoạch theo dõi |

**Response 201 Created:**
```json
{
  "success": true,
  "message": "Tao yeu cau thuc nghiem thanh cong.",
  "data": {
    "id": "req-guid",
    "title": "Thử nghiệm giống lúa ST25...",
    "status": "Pending",
    ...
  }
}
```

### 4.2 Xem danh sách yêu cầu của mình

```bash
curl -X GET "http://localhost:5038/api/experiment-requests" \
  -H "Authorization: Bearer ${TOKEN}"

# Lọc theo trạng thái
curl -X GET "http://localhost:5038/api/experiment-requests?status=Pending" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 4.3 Xem chi tiết yêu cầu

```bash
curl -X GET "http://localhost:5038/api/experiment-requests/{id}" \
  -H "Authorization: Bearer ${TOKEN}"
```

**Response 200:**
```json
{
  "id": "req-guid",
  "title": "Thử nghiệm giống lúa ST25...",
  "objective": "...",
  "status": "Pending",
  "expectedStartDate": "2025-11-01",
  "expectedEndDate": "2026-04-30",
  "monitoringPlan": "...",
  "createdAt": "2025-06-20T08:00:00Z",
  "updatedAt": "2025-06-20T08:00:00Z",
  "farmId": "...",
  "farmName": "Trang trại Bắc Giang",
  "researcherId": "...",
  "researcherName": "Tran Thi B",
  "cropVarietyId": "...",
  "cropVarietyName": "Lúa ST25",
  "procedureTemplateId": "...",
  "procedureTemplateName": "Quy trình trồng lúa mùa",
  "reviews": []
}
```

### 4.4 Cập nhật yêu cầu (chỉ Pending)

```bash
curl -X PUT "http://localhost:5038/api/experiment-requests/{id}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Cập nhật tiêu đề",
    "objective": "Cập nhật mục tiêu",
    "expectedStartDate": "2025-12-01"
  }'
```

> ⚠️ Chỉ cập nhật được khi `status == "Pending"`.

### 4.5 Xóa yêu cầu

```bash
curl -X DELETE "http://localhost:5038/api/experiment-requests/{id}" \
  -H "Authorization: Bearer ${TOKEN}"
```

**Response 200:**
```json
{ "success": true, "message": "Xoa yeu cau thanh cong." }
```

---

## 5. Experiments (Thí nghiệm)

> **Base Route**: `/api/experiments`
> **Auth**: Researcher chỉ quản lý experiments của mình.

### 5.1 Tạo Experiment (từ Request đã duyệt)

> ✅ **Nên dùng** endpoint này sau khi Manager duyệt request.

```bash
curl -X POST "http://localhost:5038/api/experiments/from-request/{requestId}" \
  -H "Authorization: Bearer ${TOKEN}"
```

**Response 201 Created:**
```json
{
  "success": true,
  "message": "Tao thuc nghiem tu yeu cau thanh cong. Cac lo da duoc chuyen sang trang thai Occupied.",
  "data": {
    "id": "exp-guid",
    "experimentCode": "EXP001",
    "title": "Thử nghiệm giống lúa ST25...",
    "status": "Draft",
    ...
  }
}
```

### 5.2 Tạo Experiment (tạo mới hoàn toàn)

```bash
curl -X POST "http://localhost:5038/api/experiments" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "farmId": "farm-guid",
    "cropVarietyId": "crop-guid",
    "procedureTemplateId": "template-guid",
    "experimentCode": "EXP002",
    "title": "Thí nghiệm độc lập",
    "objective": "Mục tiêu thí nghiệm",
    "hypothesis": "Giả thuyết...",
    "startDate": "2025-07-01",
    "endDate": "2025-12-31"
  }'
```

### 5.3 Lấy danh sách experiments của mình

```bash
curl -X GET "http://localhost:5038/api/experiments" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 5.4 Xem chi tiết experiment

```bash
curl -X GET "http://localhost:5038/api/experiments/{id}" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 5.5 Cập nhật experiment

```bash
curl -X PUT "http://localhost:5038/api/experiments/{id}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Tiêu đề mới",
    "objective": "Mục tiêu mới",
    "hypothesis": "Giả thuyết mới"
  }'
```

### 5.6 Cập nhật trạng thái experiment

```bash
# Draft -> Active (bắt đầu thí nghiệm)
curl -X PATCH "http://localhost:5038/api/experiments/{id}/status" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "Active"
  }'

# Active -> Completed (kết thúc)
curl -X PATCH "http://localhost:5038/api/experiments/{id}/status" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "Completed"
  }'
```

### 5.7 Xóa experiment

```bash
curl -X DELETE "http://localhost:5038/api/experiments/{id}" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## 6. Experiment Stages (Giai đoạn)

> **Base Route**: `/api/experiments/{experimentId}/stages`

### 6.1 Tạo Stage

```bash
curl -X POST "http://localhost:5038/api/experiments/{experimentId}/stages" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "stageName": "Giai đoạn 1: Ươm cây con",
    "stageOrder": 1,
    "stageType": 1,
    "objective": "Ươm và chăm sóc cây con trong 21 ngày",
    "startDate": "2025-07-01",
    "endDate": "2025-07-21"
  }'
```

**StageType enum:**
```typescript
enum ExperimentStageType {
  Nursery = 1,      // Ươm cây
  Care = 2,         // Chăm sóc
  Growth = 3,       // Sinh trưởng
  Harvest = 4,      // Thu hoạch
  Evaluation = 5,  // Đánh giá
  Other = 99
}
```

### 6.2 Lấy danh sách Stages

```bash
curl -X GET "http://localhost:5038/api/experiments/{experimentId}/stages" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 6.3 Lấy chi tiết Stage

```bash
curl -X GET "http://localhost:5038/api/experiments/{experimentId}/stages/{stageId}" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 6.4 Cập nhật Stage

```bash
curl -X PUT "http://localhost:5038/api/experiments/stages/{stageId}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "stageName": "Giai đoạn 1: Ươm cây con (đã cập nhật)",
    "startDate": "2025-07-05"
  }'
```

### 6.5 Xóa Stage

```bash
curl -X DELETE "http://localhost:5038/api/experiments/stages/{stageId}" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## 7. Experiment Groups (Nhóm)

> **Base Route**: `/api/experiments/{experimentId}/groups`

### 7.1 Tạo Group

```bash
curl -X POST "http://localhost:5038/api/experiments/{experimentId}/groups" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "groupName": "Nhóm đối chứng",
    "groupType": 1,
    "treatmentDescription": "Canh tác theo quy trình thông thường, không bón phân hữu cơ"
  }'
```

**GroupType enum:**
```typescript
enum GroupType {
  Control = 1,    // Đối chứng
  Treatment = 2    // Xử lý
}
```

### 7.2 Lấy danh sách Groups

```bash
curl -X GET "http://localhost:5038/api/experiments/{experimentId}/groups" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 7.3 Cập nhật Group

```bash
curl -X PUT "http://localhost:5038/api/experiments/groups/{groupId}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "treatmentDescription": "Cập nhật mô tả xử lý"
  }'
```

### 7.4 Xóa Group

```bash
curl -X DELETE "http://localhost:5038/api/experiments/groups/{groupId}" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## 8. Experiment Design (Thiết kế)

> **Base Route**: `/api/experiments/{experimentId}/design`

### 8.1 Tạo Design

```bash
curl -X POST "http://localhost:5038/api/experiments/{experimentId}/design" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "designType": 2,
    "replicationCount": 3,
    "randomizationMethod": "Randomized Complete Block Design (RCBD)",
    "designParameters": "{\"blockSize\": 5, \"spacing\": \"20x20cm\"}"
  }'
```

**DesignType enum:**
```typescript
enum DesignType {
  CompletelyRandomized = 1,
  RandomizedCompleteBlock = 2,
  Factorial = 3,
  Observational = 4,
  Other = 5
}
```

### 8.2 Lấy Design

```bash
curl -X GET "http://localhost:5038/api/experiments/{experimentId}/design" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 8.3 Cập nhật Design

```bash
curl -X PUT "http://localhost:5038/api/experiments/{experimentId}/design" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "replicationCount": 4
  }'
```

### 8.4 Xóa Design

```bash
curl -X DELETE "http://localhost:5038/api/experiments/{experimentId}/design" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## 9. Measurement Definitions (Định nghĩa đo lường)

> **Base Route**: `/api/experiments/{experimentId}/measurements`

### 9.1 Tạo Measurement Definition

```bash
curl -X POST "http://localhost:5038/api/experiments/{experimentId}/measurements" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "groupId": "group-guid",
    "metricName": "Chiều cao cây",
    "unit": "cm",
    "targetValue": 80.5,
    "description": "Đo chiều cao từ gốc đến đỉnh lá cao nhất"
  }'
```

### 9.2 Lấy danh sách Measurements

```bash
curl -X GET "http://localhost:5038/api/experiments/{experimentId}/measurements" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 9.3 Cập nhật Measurement

```bash
curl -X PUT "http://localhost:5038/api/experiments/measurements/{measurementId}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "targetValue": 85.0
  }'
```

### 9.4 Xóa Measurement

```bash
curl -X DELETE "http://localhost:5038/api/experiments/measurements/{measurementId}" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## 10. Procedure Templates (Mẫu quy trình)

> **Base Route**: `/api/experiments/procedure-templates`
> **Auth**: Researcher tạo/sửa template của mình.

### 10.1 Tạo Procedure Template

```bash
curl -X POST "http://localhost:5038/api/experiments/procedure-templates" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "cropVarietyId": "crop-guid",
    "templateName": "Quy trình trồng lúa mùa đông",
    "objective": "Hướng dẫn canh tác lúa mùa đông hiệu quả",
    "description": "Áp dụng cho vùng Bắc Bộ",
    "steps": [
      {
        "stepOrder": 1,
        "title": "Làm đất",
        "instruction": "Cày bừa, san phẳng, giữ nước 2-3 ngày",
        "expectedDurationDays": 7,
        "requiredSkillDescription": "Vận hành máy cày",
        "stageType": 1
      },
      {
        "stepOrder": 2,
        "title": "Gieo sạ",
        "instruction": "Gieo đều với mật độ 150-180 kg/ha",
        "expectedDurationDays": 1,
        "stageType": 1
      }
    ]
  }'
```

### 10.2 Lấy danh sách Templates

```bash
curl -X GET "http://localhost:5038/api/experiments/procedure-templates" \
  -H "Authorization: Bearer ${TOKEN}"

# Lọc theo giống cây
curl -X GET "http://localhost:5038/api/experiments/procedure-templates?cropVarietyId={id}" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 10.3 Xem chi tiết Template

```bash
curl -X GET "http://localhost:5038/api/experiments/procedure-templates/{id}" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 10.4 Xóa Template

```bash
curl -X DELETE "http://localhost:5038/api/experiments/procedure-templates/{id}" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## 11. Care Schedules (Lịch chăm sóc)

> **Base Route**: `/api/experiments/{experimentId}/schedules`

### 11.1 Tạo Care Schedule

```bash
curl -X POST "http://localhost:5038/api/experiments/{experimentId}/schedules" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "experimentStageId": "stage-guid",
    "batchId": "batch-guid",
    "title": "Tưới nước buổi sáng",
    "instruction": "Tưới 2 lít/m² vào buổi sáng trước 9h",
    "frequencyDays": 1,
    "startDate": "2025-07-01",
    "endDate": "2025-12-31"
  }'
```

### 11.2 Lấy danh sách Schedules

```bash
curl -X GET "http://localhost:5038/api/experiments/{experimentId}/schedules" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 11.3 Cập nhật Schedule

```bash
curl -X PUT "http://localhost:5038/api/experiments/schedules/{scheduleId}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "frequencyDays": 2,
    "instruction": "Cập nhật hướng dẫn"
  }'
```

### 11.4 Xóa Schedule

```bash
curl -X DELETE "http://localhost:5038/api/experiments/schedules/{scheduleId}" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## 12. Tasks (Tác vụ)

> **Base Route**: `/api/tasks`

### 12.1 Tạo Task thủ công

```bash
curl -X POST "http://localhost:5038/api/tasks" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "experimentId": "exp-guid",
    "experimentStageId": "stage-guid",
    "batchId": "batch-guid",
    "careScheduleId": "schedule-guid",
    "taskType": "Watering",
    "title": "Tưới nước ngày 01/07",
    "description": "Tưới 2 lít/m² cho khu A1",
    "requiredSkillDescription": "Vận hành hệ thống tưới tự động",
    "dueDate": "2025-07-01T09:00:00Z"
  }'
```

**TaskType enum:**
```typescript
enum TaskType {
  Planting = 1,
  Watering = 2,
  Fertilizing = 3,
  Observation = 4,
  Inspection = 5,
  Harvest = 6,
  Other = 7
}
```

### 12.2 Auto-generate Tasks từ Experiment

```bash
# Sinh toàn bộ tasks từ tất cả stages và schedules
curl -X POST "http://localhost:5038/api/tasks/generate-by-experiment/{experimentId}" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 12.3 Auto-generate Tasks từ Stage

```bash
curl -X POST "http://localhost:5038/api/tasks/generate-by-stage/{stageId}" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 12.4 Lấy Tasks của experiment

```bash
curl -X GET "http://localhost:5038/api/tasks/experiment/{experimentId}" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 12.5 Lấy Tasks theo Stage

```bash
curl -X GET "http://localhost:5038/api/tasks/stage/{stageId}" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 12.6 Lấy Tasks theo Batch

```bash
curl -X GET "http://localhost:5038/api/tasks/batch/{batchId}" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 12.7 Lấy Tasks theo User

```bash
curl -X GET "http://localhost:5038/api/tasks/user/{userId}" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 12.8 Lấy Tasks của mình

```bash
curl -X GET "http://localhost:5038/api/tasks/my" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 12.9 Lấy Tasks hôm nay

```bash
curl -X GET "http://localhost:5038/api/tasks/today" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 12.10 Lấy Tasks sắp tới

```bash
# Mặc định 7 ngày
curl -X GET "http://localhost:5038/api/tasks/upcoming" \
  -H "Authorization: Bearer ${TOKEN}"

# Tùy chỉnh số ngày
curl -X GET "http://localhost:5038/api/tasks/upcoming?days=14" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 12.11 Lấy Tasks quá hạn

```bash
curl -X GET "http://localhost:5038/api/tasks/overdue" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 12.12 Bắt đầu Task (Pending -> InProgress)

```bash
curl -X PATCH "http://localhost:5038/api/tasks/{id}/start" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 12.13 Hoàn thành Task (InProgress -> Completed)

```bash
curl -X PATCH "http://localhost:5038/api/tasks/{id}/complete" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 12.14 Hủy Task

```bash
curl -X PATCH "http://localhost:5038/api/tasks/{id}/cancel" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 12.15 Cập nhật trạng thái Task (generic)

```bash
curl -X PATCH "http://localhost:5038/api/tasks/{id}/status" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "InProgress"
  }'
```

### 12.16 Cập nhật Assignment Status

```bash
curl -X PATCH "http://localhost:5038/api/tasks/assignments/status" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "assignmentId": "assignment-guid",
    "status": "Completed"
  }'
```

**TaskAssignmentStatus enum:**
```typescript
enum TaskAssignmentStatus {
  Assigned = 1,     // Đã gán
  Reassigned = 2,   // Chuyển giao
  Resigned = 3,     // Từ chối
  Completed = 4,    // Hoàn thành
  Cancelled = 5     // Hủy
}
```

### 12.17 Lấy Assignments của Task

```bash
curl -X GET "http://localhost:5038/api/tasks/{taskId}/assignments" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 12.18 Lấy Assignments của mình

```bash
curl -X GET "http://localhost:5038/api/tasks/assignments/my" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 12.19 Chuyển giao Task (Reassign)

```bash
curl -X POST "http://localhost:5038/api/tasks/reassign" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "task-guid",
    "newAssigneeId": "new-user-guid",
    "reason": "Người trước bận việc khác"
  }'
```

### 12.20 Gán Task cho User

```bash
curl -X POST "http://localhost:5038/api/tasks/assign" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "task-guid",
    "assigneeId": "user-guid",
    "reason": "Người có kỹ năng phù hợp"
  }'
```

### 12.21 Tìm User phù hợp với Task

```bash
curl -X GET "http://localhost:5038/api/tasks/{taskId}/skill-matches" \
  -H "Authorization: Bearer ${TOKEN}"
```

**Response:**
```json
[
  {
    "userId": "user-guid",
    "fullName": "Nguyen Van C",
    "email": "tech@...",
    "roleName": "Technician",
    "matchScore": 85,
    "matchedSkills": [
      {
        "skillId": "...",
        "skillName": "Vận hành tưới tự động",
        "requiredLevel": 2,
        "userLevel": 3
      }
    ],
    "missingSkills": []
  }
]
```

### 12.22 Xóa Task

```bash
curl -X DELETE "http://localhost:5038/api/tasks/{id}" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## 13. Task Reports (Báo cáo tác vụ)

> **Base Route**: `/api/task-reports`
> **Auth**: Người được giao task (Technician/Student) viết báo cáo.

### 13.1 Tạo Task Report

```bash
curl -X POST "http://localhost:5038/api/task-reports" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "task-guid",
    "reportText": "Đã hoàn thành tưới nước cho khu A1. Lượng nước tưới 2.5 lít/m².",
    "resultData": {
      "waterUsed": 500,
      "duration": 45,
      "weatherCondition": "Nắng nhẹ"
    }
  }'
```

### 13.2 Lấy Reports theo Task

```bash
curl -X GET "http://localhost:5038/api/task-reports/task/{taskId}" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 13.3 Lấy Reports theo Batch

```bash
curl -X GET "http://localhost:5038/api/task-reports/batch/{batchId}" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 13.4 Cập nhật Report

```bash
curl -X PUT "http://localhost:5038/api/task-reports/{reportId}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "reportText": "Cập nhật báo cáo...",
    "resultData": {
      "waterUsed": 520
    }
  }'
```

---

## 14. Batches (Lô)

> **Base Route**: `/api/batches`

### 14.1 Tạo Batch

```bash
curl -X POST "http://localhost:5038/api/batches" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "experimentId": "exp-guid",
    "experimentBedAssignmentId": "assignment-guid",
    "groupId": "group-guid",
    "cropVarietyId": "crop-guid",
    "batchCode": "BATCH001",
    "plantingDate": "2025-07-01",
    "expectedHarvestDate": "2025-12-15",
    "plantCount": 100,
    "notes": "Trồng thử nghiệm 100 cây giống ST25"
  }'
```

### 14.2 Lấy Batches theo Experiment

```bash
curl -X GET "http://localhost:5038/api/batches/experiments/{experimentId}" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 14.3 Xem chi tiết Batch

```bash
curl -X GET "http://localhost:5038/api/batches/{id}" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 14.4 Cập nhật Batch

```bash
curl -X PUT "http://localhost:5038/api/batches/{id}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "expectedHarvestDate": "2025-12-20",
    "notes": "Cập nhật ghi chú"
  }'
```

### 14.5 Xóa Batch

```bash
curl -X DELETE "http://localhost:5038/api/batches/{id}" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## 15. Measurement Records (Ghi nhận đo lường)

> **Base Route**: `/api/measurement-records`
> **Auth**: Bất kỳ authenticated user nào đều có thể ghi nhận đo lường.

### 15.1 Tạo Measurement Record

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
      "location": "Khu A1-Lô 3",
      "note": "Cây số 15"
    },
    "measuredAt": "2025-07-15T10:30:00Z"
  }'
```

### 15.2 Lấy lịch sử đo lường theo Batch

```bash
curl -X GET "http://localhost:5038/api/measurement-records/batch/{batchId}" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 15.3 Cập nhật Record

```bash
curl -X PUT "http://localhost:5038/api/measurement-records/{id}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "value": 78.0,
    "measuredAt": "2025-07-15T11:00:00Z"
  }'
```

### 15.4 Xóa Record

```bash
curl -X DELETE "http://localhost:5038/api/measurement-records/{id}" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## 16. Enums & Quy tắc chung

### 16.1 ExperimentStatus

```typescript
enum ExperimentStatus {
  Draft = 1,
  Approved = 2,
  Active = 3,
  Completed = 4,
  Cancelled = 5
}
```

### 16.2 RequestStatus

```typescript
enum RequestStatus {
  Pending = 1,    // Chờ duyệt
  Approved = 2,   // Đã duyệt
  Rejected = 3,   // Bị từ chối
  Cancelled = 4   // Đã hủy
}
```

### 16.3 TaskStatus

```typescript
enum TaskStatus {
  Pending = 1,
  InProgress = 2,
  Completed = 3,
  Overdue = 4,
  Cancelled = 5
}
```

### 16.4 TaskType

```typescript
enum TaskType {
  Planting = 1,
  Watering = 2,
  Fertilizing = 3,
  Observation = 4,
  Inspection = 5,
  Harvest = 6,
  Other = 7
}
```

### 16.5 BatchStatus

```typescript
enum BatchStatus {
  Planned = 1,
  Growing = 2,
  Harvested = 3,
  Discarded = 4,
  Completed = 5
}
```

### 16.6 Quy tắc cho Researcher

| Quy tắc | Chi tiết |
|---------|----------|
| **Tạo Experiment Request** | Gửi đến farm có Manager. Status ban đầu = `Pending`. |
| **Tạo Experiment** | Từ request đã duyệt (tự động assign beds) hoặc tạo mới |
| **Quản lý Experiment** | Chỉ owner (Researcher tạo) mới có quyền sửa/xóa |
| **Gán Task** | Chỉ Researcher gán được task cho Technician/Student |
| **Task Assignment** | Assignee phải có role phù hợp |
| **Task Reports** | Chỉ assignee mới được tạo report |
| **Measurement Records** | Bất kỳ user nào đều có thể ghi nhận |

### 16.7 Date Format

- `DateOnly`: `yyyy-MM-dd` (ví dụ: `2025-07-01`)
- `DateTime`: ISO 8601 (ví dụ: `2025-07-01T09:00:00Z`)

---

## Phụ lục: Tổng hợp endpoints của Researcher

| Nhóm | Endpoint | Method | Role |
|------|----------|--------|------|
| Auth | `/api/auth/login` | POST | Public |
| Auth | `/api/auth/google-login` | POST | Public |
| Auth | `/api/auth/forgot-password` | POST | Public |
| Auth | `/api/auth/verify-code` | POST | Public |
| Auth | `/api/auth/reset-password` | POST | Public |
| Request | `/api/experiment-requests` | POST | Researcher |
| Request | `/api/experiment-requests` | GET | Researcher |
| Request | `/api/experiment-requests/{id}` | GET | Researcher (owner) |
| Request | `/api/experiment-requests/{id}` | PUT | Researcher (owner, Pending) |
| Request | `/api/experiment-requests/{id}` | DELETE | Researcher (owner) |
| Experiment | `/api/experiments` | POST | Researcher |
| Experiment | `/api/experiments/from-request/{id}` | POST | Researcher |
| Experiment | `/api/experiments` | GET | Researcher (own) |
| Experiment | `/api/experiments/{id}` | GET | Researcher (owner) |
| Experiment | `/api/experiments/{id}` | PUT | Researcher (owner) |
| Experiment | `/api/experiments/{id}` | PATCH (status) | Researcher (owner) |
| Experiment | `/api/experiments/{id}` | DELETE | Researcher (owner) |
| Stage | `/api/experiments/{id}/stages` | POST | Researcher (owner) |
| Stage | `/api/experiments/{id}/stages/{stageId}` | GET | Researcher (owner) |
| Stage | `/api/experiments/{id}/stages` | GET | Researcher (owner) |
| Stage | `/api/experiments/stages/{id}` | PUT | Researcher (owner) |
| Stage | `/api/experiments/stages/{id}` | DELETE | Researcher (owner) |
| Group | `/api/experiments/{id}/groups` | POST | Researcher (owner) |
| Group | `/api/experiments/{id}/groups` | GET | Researcher (owner) |
| Group | `/api/experiments/{id}/groups/{groupId}` | GET | Researcher (owner) |
| Group | `/api/experiments/groups/{id}` | PUT | Researcher (owner) |
| Group | `/api/experiments/groups/{id}` | DELETE | Researcher (owner) |
| Design | `/api/experiments/{id}/design` | POST | Researcher (owner) |
| Design | `/api/experiments/{id}/design` | GET | Researcher/Manager |
| Design | `/api/experiments/{id}/design` | PUT | Researcher (owner) |
| Design | `/api/experiments/{id}/design` | DELETE | Researcher (owner) |
| Measurement | `/api/experiments/{id}/measurements` | POST | Researcher (owner) |
| Measurement | `/api/experiments/{id}/measurements` | GET | Researcher (owner) |
| Measurement | `/api/experiments/measurements/{id}` | PUT | Researcher (owner) |
| Measurement | `/api/experiments/measurements/{id}` | DELETE | Researcher (owner) |
| Template | `/api/experiments/procedure-templates` | POST | Researcher |
| Template | `/api/experiments/procedure-templates` | GET | Researcher/Manager |
| Template | `/api/experiments/procedure-templates/{id}` | GET | Researcher/Manager |
| Template | `/api/experiments/procedure-templates/{id}` | DELETE | Researcher |
| Schedule | `/api/experiments/{id}/schedules` | POST | Researcher (owner) |
| Schedule | `/api/experiments/{id}/schedules` | GET | Researcher (owner) |
| Schedule | `/api/experiments/schedules/{id}` | PUT | Researcher (owner) |
| Schedule | `/api/experiments/schedules/{id}` | DELETE | Researcher (owner) |
| Task | `/api/tasks` | POST | Researcher |
| Task | `/api/tasks/generate-by-stage/{id}` | POST | Researcher |
| Task | `/api/tasks/generate-by-experiment/{id}` | POST | Researcher (owner) |
| Task | `/api/tasks` | GET | Researcher (conditional) |
| Task | `/api/tasks/{id}` | GET | Authenticated |
| Task | `/api/tasks/{id}` | PUT | Researcher (owner) |
| Task | `/api/tasks/{id}` | DELETE | Researcher (owner) |
| Task | `/api/tasks/experiment/{id}` | GET | Researcher (owner) |
| Task | `/api/tasks/stage/{id}` | GET | Authenticated |
| Task | `/api/tasks/batch/{id}` | GET | Authenticated |
| Task | `/api/tasks/user/{id}` | GET | Researcher |
| Task | `/api/tasks/my` | GET | Authenticated |
| Task | `/api/tasks/today` | GET | Authenticated |
| Task | `/api/tasks/upcoming` | GET | Authenticated |
| Task | `/api/tasks/overdue` | GET | Authenticated |
| Task | `/api/tasks/{id}/start` | PATCH | Assignee |
| Task | `/api/tasks/{id}/complete` | PATCH | Assignee |
| Task | `/api/tasks/{id}/cancel` | PATCH | Researcher (owner) |
| Task | `/api/tasks/{id}/status` | PATCH | Researcher/Assignee |
| Task | `/api/tasks/assign` | POST | Researcher |
| Task | `/api/tasks/reassign` | POST | Researcher |
| Task | `/api/tasks/assignments/status` | PATCH | Authenticated |
| Task | `/api/tasks/{id}/assignments` | GET | Researcher (owner) |
| Task | `/api/tasks/assignments/my` | GET | Authenticated |
| Task | `/api/tasks/{id}/skill-matches` | GET | Researcher (owner) |
| Batch | `/api/batches` | POST | Researcher (owner) |
| Batch | `/api/batches/experiments/{id}` | GET | Researcher (owner) |
| Batch | `/api/batches/{id}` | GET | Researcher (owner) |
| Batch | `/api/batches/{id}` | PUT | Researcher (owner) |
| Batch | `/api/batches/{id}` | DELETE | Researcher (owner) |
| Report | `/api/task-reports` | POST | Assignee |
| Report | `/api/task-reports/task/{id}` | GET | Authenticated |
| Report | `/api/task-reports/batch/{id}` | GET | Authenticated |
| Report | `/api/task-reports/{id}` | GET | Authenticated |
| Report | `/api/task-reports/{id}` | PUT | Owner |
| Image | `/api/task-images/upload` | POST | Authenticated |
| Image | `/api/task-images/task/{id}` | GET | Authenticated |
| Image | `/api/task-images/batch/{id}` | GET | Authenticated |
| Image | `/api/task-images/{id}` | DELETE | Owner |
| Measurement | `/api/measurement-records` | POST | Authenticated |
| Measurement | `/api/measurement-records/batch/{id}` | GET | Authenticated |
| Measurement | `/api/measurement-records/{id}` | PUT | Authenticated |
| Measurement | `/api/measurement-records/{id}` | DELETE | Authenticated |
| Notification | `/api/notifications` | GET | Authenticated |
| Notification | `/api/notifications/unread-count` | GET | Authenticated |
| Notification | `/api/notifications/{id}/read` | PUT | Owner |
| Notification | `/api/notifications/read-all` | PUT | Authenticated |

---

**Version**: 1.0  
**Ngày tạo**: 28/06/2026  
**Backend**: SmartFarm SEP490 (.NET 8 + JWT + EF Core)