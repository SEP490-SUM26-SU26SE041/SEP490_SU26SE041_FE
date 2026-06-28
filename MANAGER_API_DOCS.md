# SmartFarm SEP490 - Manager API Documentation

> Tài liệu này dành cho **Frontend** để tích hợp với các API dành cho role **Manager**.
> Manager là người quản lý farm, duyệt yêu cầu thí nghiệm và giám sát tiến độ.

---

## Mục lục

1. [Thông tin chung](#1-thông-tin-chung)
2. [Authentication](#2-authentication)
3. [Quản lý Farm (Nông trại)](#3-quản-lý-farm-nông-trại)
4. [Quản lý Area (Khu vực)](#4-quản-lý-area-khu-vực)
5. [Quản lý Bed (Lô trồng)](#5-quản-lý-bed-lô-trồng)
6. [Bed Assignments (Gán lô)](#6-bed-assignments-gán-lô)
7. [Experiment Requests (Duyệt yêu cầu)](#7-experiment-requests-duyệt-yêu-cầu)
8. [Xem Experiments (Read-only)](#8-xem-experiments-read-only)
9. [Notifications (Thông báo)](#9-notifications-thông-báo)
10. [Enums & Quy tắc chung](#10-enums--quy-tắc-chung)

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
  - `role`: `"Manager"` (hoặc `"Admin"`)

### Đặc điểm quyền của Manager

| Chức năng | Quyền |
|-----------|--------|
| Quản lý Farm/Area/Bed | ✅ Full CRUD |
| Duyệt Experiment Request | ✅ |
| Xem Experiments | ✅ (của farm mình) |
| Gán beds cho experiment | ✅ |
| Xem Batches | ❌ (bị Forbid) |
| Tạo/Sửa/Xóa Experiments | ❌ |
| Tạo/Sửa/Xóa Tasks | ❌ |

### Quy tắc truy cập

| Quy tắc | Chi tiết |
|---------|----------|
| **Farm Access** | Chỉ truy cập farm có `ManagerId == userId` hoặc Admin |
| **Review Request** | Chỉ duyệt request của farm mình quản lý |
| **Batches** | Manager bị Forbid khi truy cập BatchesController |

---

## 2. Authentication

### 2.1 Login (Public)

```bash
curl -X POST "http://localhost:5038/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manager@smartfarm.com",
    "password": "your_password"
  }'
```

**Response 200 OK:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "email": "manager@smartfarm.com",
  "role": "Manager",
  "fullName": "Nguyen Van A"
}
```

### 2.2 Forgot Password (Public)

```bash
curl -X POST "http://localhost:5038/api/auth/forgot-password" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manager@smartfarm.com"
  }'
```

### 2.3 Verify Code (Public)

```bash
curl -X POST "http://localhost:5038/api/auth/verify-code" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manager@smartfarm.com",
    "code": "123456"
  }'
```

### 2.4 Reset Password (Public)

```bash
curl -X POST "http://localhost:5038/api/auth/reset-password" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manager@smartfarm.com",
    "code": "123456",
    "newPassword": "new_password_123"
  }'
```

---

## 3. Quản lý Farm (Nông trại)

> **Base Route**: `/api/farms`
> **Auth**: `[Authorize(Roles = "Manager")]`

### 3.1 Tạo Farm mới

```bash
curl -X POST "http://localhost:5038/api/farms" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "farmCode": "FARM001",
    "farmName": "Trang trại Bắc Giang",
    "location": "Bắc Giang",
    "description": "Trang trại rau hữu cơ"
  }'
```

**Body Schema:**
| Field | Type | Required | Note |
|-------|------|----------|------|
| `farmCode` | string | ✅ | Mã nông trại (unique) |
| `farmName` | string | ✅ | Tên nông trại |
| `location` | string | ❌ | Địa điểm |
| `description` | string | ❌ | Mô tả |

> ⚠️ **Logic ngầm**: Sau khi tạo, user tạo sẽ tự động được gán làm `Manager` của farm đó.

### 3.2 Lấy danh sách Farm của mình

> ✅ **Endpoint quan trọng** - Lấy farm mà mình quản lý.

```bash
curl -X GET "http://localhost:5038/api/farms/my-farms" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 3.3 Lấy tất cả Farm

```bash
curl -X GET "http://localhost:5038/api/farms" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 3.4 Lấy chi tiết Farm

```bash
curl -X GET "http://localhost:5038/api/farms/{id}" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 3.5 Cập nhật Farm

```bash
curl -X PUT "http://localhost:5038/api/farms/{id}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "farmName": "Trang trại Bắc Giang (mới)",
    "location": "Bắc Giang - Lạng Sơn",
    "description": "Mô tả cập nhật"
  }'
```

### 3.6 Gán Manager cho Farm

```bash
curl -X POST "http://localhost:5038/api/farms/{farmId}/manager/{managerId}" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 3.7 Xóa Farm

```bash
curl -X DELETE "http://localhost:5038/api/farms/{id}" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## 4. Quản lý Area (Khu vực)

> **Base Route**: `/api/farms/areas`

### 4.1 Tạo Area

```bash
curl -X POST "http://localhost:5038/api/farms/areas" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "farmId": "farm-guid",
    "areaCode": "AREA001",
    "areaName": "Khu A1",
    "environmentType": "Greenhouse",
    "totalArea": 500.0,
    "status": 1
  }'
```

**Body Schema:**
| Field | Type | Required | Note |
|-------|------|----------|------|
| `farmId` | Guid | ✅ | Farm cha |
| `areaCode` | string | ✅ | Mã khu vực |
| `areaName` | string | ✅ | Tên khu vực |
| `environmentType` | string | ❌ | Loại môi trường |
| `totalArea` | decimal | ❌ | Diện tích (m²) |
| `status` | int | ❌ | 1=Available, 2=InUse, 3=Maintenance, 4=Unavailable |

### 4.2 Lấy Areas theo Farm

```bash
curl -X GET "http://localhost:5038/api/farms/farms/{farmId}/areas" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 4.3 Lấy chi tiết Area

```bash
curl -X GET "http://localhost:5038/api/farms/areas/{id}" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 4.4 Cập nhật Area

```bash
curl -X PUT "http://localhost:5038/api/farms/areas/{id}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "areaName": "Khu A1 (mở rộng)",
    "status": 2
  }'
```

### 4.5 Xóa Area

```bash
curl -X DELETE "http://localhost:5038/api/farms/areas/{id}" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## 5. Quản lý Bed (Lô trồng)

> **Base Route**: `/api/farms/beds`

### 5.1 Tạo Bed

```bash
curl -X POST "http://localhost:5038/api/farms/beds" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "areaId": "area-guid",
    "bedCode": "BED001",
    "soilDescription": "Đất thịt pha cát, pH 6.5",
    "length": 10.0,
    "width": 2.0
  }'
```

### 5.2 Lấy Beds theo Area

```bash
curl -X GET "http://localhost:5038/api/farms/areas/{areaId}/beds" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 5.3 Lấy Beds trống (Available) theo Farm

> ✅ **Endpoint quan trọng** - Dùng khi duyệt experiment request để chọn beds.

```bash
curl -X GET "http://localhost:5038/api/farms/farms/{farmId}/beds/available" \
  -H "Authorization: Bearer ${TOKEN}"
```

**Response 200:**
```json
[
  {
    "id": "bed-guid",
    "bedCode": "BED001",
    "soilDescription": "...",
    "length": 10.0,
    "width": 2.0,
    "allocationStatus": "Available",
    "areaId": "...",
    "areaName": "Khu A1",
    "farmId": "...",
    "createdAt": "...",
    "updatedAt": "..."
  }
]
```

### 5.4 Lấy chi tiết Bed

```bash
curl -X GET "http://localhost:5038/api/farms/beds/{id}" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 5.5 Cập nhật Bed

```bash
curl -X PUT "http://localhost:5038/api/farms/beds/{id}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "bedCode": "BED001-NEW",
    "soilDescription": "Đất đã cải tạo"
  }'
```

### 5.6 Xóa Bed

```bash
curl -X DELETE "http://localhost:5038/api/farms/beds/{id}" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## 6. Bed Assignments (Gán lô)

> **Base Route**: `/api/farms/bed-assignments`
> **Mục đích**: Gán một lô trồng cho experiment/request.

### 6.1 Tạo Bed Assignment

```bash
curl -X POST "http://localhost:5038/api/farms/bed-assignments" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "request-guid-optional",
    "experimentId": "experiment-guid-optional",
    "bedId": "bed-guid",
    "assignedFrom": "2025-07-01",
    "assignedTo": "2025-12-31",
    "purpose": "Trồng thử nghiệm giống cà chua mới"
  }'
```

### 6.2 Lấy Bed Assignments theo Experiment

```bash
curl -X GET "http://localhost:5038/api/farms/experiments/{experimentId}/bed-assignments" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 6.3 Lấy chi tiết Bed Assignment

```bash
curl -X GET "http://localhost:5038/api/farms/bed-assignments/{id}" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 6.4 Cập nhật Bed Assignment

```bash
curl -X PUT "http://localhost:5038/api/farms/bed-assignments/{id}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "assignedTo": "2026-01-31",
    "purpose": "Gia hạn thêm 1 tháng"
  }'
```

### 6.5 Xóa Bed Assignment

```bash
curl -X DELETE "http://localhost:5038/api/farms/bed-assignments/{id}" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## 7. Experiment Requests (Duyệt yêu cầu)

> **Base Route**: `/api/experiment-requests`
> **Đây là chức năng quan trọng nhất của Manager**.

### 7.1 Hộp thư đến (Manager Inbox)

> ✅ **Endpoint quan trọng nhất** - Lấy danh sách request cần duyệt.

```bash
# Tất cả request
curl -X GET "http://localhost:5038/api/experiment-requests/manager/inbox" \
  -H "Authorization: Bearer ${TOKEN}"

# Chỉ request Pending
curl -X GET "http://localhost:5038/api/experiment-requests/manager/inbox?status=Pending" \
  -H "Authorization: Bearer ${TOKEN}"
```

**Query params:**
| Param | Type | Note |
|-------|------|------|
| `status` | string | `Pending`, `Approved`, `Rejected`, `Cancelled` |

**Response 200:**
```json
{
  "success": true,
  "message": "Lay danh sach hop thu thanh cong.",
  "data": [
    {
      "id": "req-guid",
      "title": "Thử nghiệm giống lúa ST25",
      "objective": "Đánh giá năng suất giống ST25",
      "status": "Pending",
      "expectedStartDate": "2025-11-01",
      "expectedEndDate": "2026-04-30",
      "monitoringPlan": "...",
      "createdAt": "2025-06-20T08:00:00Z",
      "farmId": "...",
      "farmName": "Trang trại Bắc Giang",
      "researcherId": "...",
      "researcherName": "Tran Thi B",
      "cropVarietyName": "Lúa ST25",
      "procedureTemplateName": "Quy trình trồng lúa mùa",
      "reviews": []
    }
  ]
}
```

### 7.2 Lấy chi tiết Request

```bash
curl -X GET "http://localhost:5038/api/experiment-requests/{id}" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 7.3 Xem tóm tắt tài nguyên (Resource Summary)

> ✅ **Endpoint quan trọng** - Xem trước khi duyệt để biết farm còn đủ beds không.

```bash
curl -X GET "http://localhost:5038/api/experiment-requests/{id}/resource-summary" \
  -H "Authorization: Bearer ${TOKEN}"
```

**Response 200:**
```json
{
  "isValid": true,
  "sufficientBeds": true,
  "sufficientSensors": true,
  "message": "Tài nguyên đáp ứng đủ.",
  "resources": {
    "farmId": "...",
    "farmName": "Trang trại Bắc Giang",
    "totalBeds": 20,
    "availableBeds": 8,
    "inUseBeds": 10,
    "maintenanceBeds": 2,
    "totalSensors": 15,
    "totalAreas": 4
  },
  "availableBeds": [
    {
      "id": "bed1-guid",
      "bedCode": "BED001",
      "areaName": "Khu A1",
      "allocationStatus": "Available",
      ...
    }
  ]
}
```

### 7.4 Xem Beds đã giữ cho Request

```bash
curl -X GET "http://localhost:5038/api/experiment-requests/{id}/reserved-beds" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 7.5 Duyệt/Yêu cầu (Approve/Reject)

> ✅ **Endpoint core** - Duyệt hoặc từ chối request.

```bash
# ✅ DUYỆT - bắt buộc chọn beds để giữ
curl -X POST "http://localhost:5038/api/experiment-requests/{id}/review" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "result": 1,
    "comment": "Đồng ý, sử dụng 2 lô trong khu A1",
    "reservedBedIds": [
      "bed-guid-1",
      "bed-guid-2"
    ]
  }'

# ❌ TỪ CHỐI
curl -X POST "http://localhost:5038/api/experiment-requests/{id}/review" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "result": 2,
    "comment": "Không đủ tài nguyên trong giai đoạn này"
  }'
```

**Body Schema:**
| Field | Type | Required | Note |
|-------|------|----------|------|
| `result` | int | ✅ | 1 = Approved, 2 = Rejected |
| `comment` | string | ❌ | Lý do duyệt/từ chối |
| `reservedBedIds` | Guid[] | ⚠️ | **Bắt buộc nếu Approved**, tối thiểu 1 bed |

**Lỗi 400 thường gặp:**
- `"Khi duyet yeu cau, can chon it nhat mot lo de giu cho."` → Quên `reservedBedIds`
- `"Yeu cau da o trang thai 'X'. Khong the duyet lai."` → Request không ở Pending

### 7.6 Lấy danh sách Request (có filter)

```bash
# Tất cả request của farm mình
curl -X GET "http://localhost:5038/api/experiment-requests" \
  -H "Authorization: Bearer ${TOKEN}"

# Lọc theo farm
curl -X GET "http://localhost:5038/api/experiment-requests?farmId={farmId}" \
  -H "Authorization: Bearer ${TOKEN}"

# Lọc theo trạng thái
curl -X GET "http://localhost:5038/api/experiment-requests?status=Approved" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 📋 Flow UI gợi ý cho Manager

```
┌──────────────────────────────────────────────────────────────┐
│  Dashboard Manager                                           │
├──────────────────────────────────────────────────────────────┤
│  📋 Yêu cầu chờ duyệt: 5                                  │
│  🌾 Farm đang quản lý: 2                                    │
│  📊 Experiment đang hoạt động: 12                          │
├──────────────────────────────────────────────────────────────┤
│  [Yêu cầu chờ duyệt]                                       │
│  ├─ 📄 Thử nghiệm lúa ST25 - Pending                      │
│  ├─ 📄 Thử nghiệm cà chua mùa đông - Pending             │
│  └─ 📄 Thử nghiệm rau muống - Pending                    │
└──────────────────────────────────────────────────────────────┘

Flow xử lý:
1. GET /api/experiment-requests/manager/inbox?status=Pending
   → Hiển thị danh sách request

2. Click vào request
   → GET /api/experiment-requests/{id} (chi tiết)
   → GET /api/experiment-requests/{id}/resource-summary (tài nguyên)
   
3. Manager chọn "Duyệt"
   → Hiển thị danh sách availableBeds từ resource-summary
   → Manager tick chọn bed(s)
   → POST /api/experiment-requests/{id}/review với result=1 + reservedBedIds
   
4. Manager chọn "Từ chối"
   → Nhập lý do
   → POST /api/experiment-requests/{id}/review với result=2
```

---

## 8. Xem Experiments (Read-only)

> **Base Route**: `/api/experiments`
> **Auth**: Manager chỉ xem được experiments thuộc farm mình quản lý.

### 8.1 Lấy danh sách Experiments

```bash
# Tất cả experiments của farm mình
curl -X GET "http://localhost:5038/api/experiments" \
  -H "Authorization: Bearer ${TOKEN}"

# Lọc theo farm cụ thể
curl -X GET "http://localhost:5038/api/experiments?farmId={farmId}" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 8.2 Xem chi tiết Experiment

```bash
curl -X GET "http://localhost:5038/api/experiments/{id}" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 8.3 Xem Stages

```bash
curl -X GET "http://localhost:5038/api/experiments/{experimentId}/stages" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 8.4 Xem Groups

```bash
curl -X GET "http://localhost:5038/api/experiments/{experimentId}/groups" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 8.5 Xem Design

```bash
curl -X GET "http://localhost:5038/api/experiments/{experimentId}/design" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 8.6 Xem Measurements

```bash
curl -X GET "http://localhost:5038/api/experiments/{experimentId}/measurements" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 8.7 Xem Care Schedules

```bash
curl -X GET "http://localhost:5038/api/experiments/{experimentId}/schedules" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 8.8 Xem Procedure Templates

```bash
curl -X GET "http://localhost:5038/api/experiments/procedure-templates" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## 9. Notifications (Thông báo)

> **Base Route**: `/api/notifications`

### 9.1 Lấy thông báo của mình

```bash
curl -X GET "http://localhost:5038/api/notifications?pageNumber=1&pageSize=20" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 9.2 Đếm thông báo chưa đọc

> 💡 Gợi ý: Poll mỗi 30-60s cho badge notification.

```bash
curl -X GET "http://localhost:5038/api/notifications/unread-count" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 9.3 Đánh dấu đã đọc

```bash
curl -X PUT "http://localhost:5038/api/notifications/{id}/read" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 9.4 Đánh dấu tất cả đã đọc

```bash
curl -X PUT "http://localhost:5038/api/notifications/read-all" \
  -H "Authorization: Bearer ${TOKEN}"
```

### NotificationTypes thường gặp cho Manager

| NotificationType | Khi nào |
|------------------|----------|
| `ExperimentRequestReview` | Researcher gửi request mới |
| `ExperimentStatusUpdate` | Experiment thay đổi trạng thái |

---

## 10. Enums & Quy tắc chung

### 10.1 RequestStatus

```typescript
enum RequestStatus {
  Pending = 1,    // Chờ duyệt
  Approved = 2,   // Đã duyệt
  Rejected = 3,   // Bị từ chối
  Cancelled = 4   // Đã hủy
}
```

### 10.2 ReviewResult

```typescript
enum ReviewResult {
  Approved = 1,  // Chấp thuận
  Rejected = 2   // Từ chối
}
```

### 10.3 LocationStatus

```typescript
enum LocationStatus {
  Available = 1,     // Sẵn sàng
  InUse = 2,       // Đang sử dụng
  Maintenance = 3, // Bảo trì
  Unavailable = 4   // Không khả dụng
}
```

### 10.4 ExperimentStatus

```typescript
enum ExperimentStatus {
  Draft = 1,
  Approved = 2,
  Active = 3,
  Completed = 4,
  Cancelled = 5
}
```

### 10.5 Quy tắc cho Manager

| Quy tắc | Chi tiết |
|---------|----------|
| **Truy cập Farm** | Chỉ farm có `ManagerId == userId` hoặc Admin |
| **Duyệt Request** | Chỉ request gửi đến farm mình quản lý, và phải ở `Pending` |
| **Approve** | Bắt buộc chọn ít nhất 1 bed để reserve |
| **Xem Experiment** | Chỉ experiments thuộc farm mình |
| **Batches** | Manager bị Forbid, không truy cập được |

### 10.6 Xử lý lỗi chuẩn

| Status | Ý nghĩa |
|--------|----------|
| `200 OK` | Thành công |
| `201 Created` | Tạo thành công |
| `204 No Content` | Xóa thành công |
| `400 Bad Request` | Dữ liệu không hợp lệ |
| `401 Unauthorized` | Chưa đăng nhập |
| `403 Forbidden` | Không có quyền |
| `404 Not Found` | Không tìm thấy |

### 10.7 Date Format

- `DateOnly`: `yyyy-MM-dd` (ví dụ: `2025-07-01`)
- `DateTime`: ISO 8601 (ví dụ: `2025-07-01T09:00:00Z`)

---

## Phụ lục: Tổng hợp endpoints của Manager

| Nhóm | Endpoint | Method | Quyền |
|------|----------|--------|--------|
| Auth | `/api/auth/login` | POST | Public |
| Auth | `/api/auth/forgot-password` | POST | Public |
| Auth | `/api/auth/verify-code` | POST | Public |
| Auth | `/api/auth/reset-password` | POST | Public |
| Farm | `/api/farms` | GET, POST | Manager |
| Farm | `/api/farms/my-farms` | GET | Manager |
| Farm | `/api/farms/{id}` | GET, PUT, DELETE | Manager (owner) |
| Farm | `/api/farms/{farmId}/manager/{managerId}` | POST | Manager |
| Area | `/api/farms/areas` | POST | Manager |
| Area | `/api/farms/areas/{id}` | GET, PUT, DELETE | Manager (owner) |
| Area | `/api/farms/farms/{farmId}/areas` | GET | Manager |
| Bed | `/api/farms/beds` | POST | Manager |
| Bed | `/api/farms/beds/{id}` | GET, PUT, DELETE | Manager (owner) |
| Bed | `/api/farms/areas/{areaId}/beds` | GET | Manager |
| Bed | `/api/farms/farms/{farmId}/beds/available` | GET | Manager |
| Assignment | `/api/farms/bed-assignments` | POST | Manager |
| Assignment | `/api/farms/bed-assignments/{id}` | GET, PUT, DELETE | Manager (owner) |
| Assignment | `/api/farms/experiments/{id}/bed-assignments` | GET | Manager |
| Request | `/api/experiment-requests/manager/inbox` | GET | Manager |
| Request | `/api/experiment-requests` | GET | Manager |
| Request | `/api/experiment-requests/{id}` | GET | Manager (owner) |
| Request | `/api/experiment-requests/{id}/resource-summary` | GET | Manager (owner) |
| Request | `/api/experiment-requests/{id}/reserved-beds` | GET | Manager (owner) |
| Request | `/api/experiment-requests/{id}/review` | POST | Manager (owner) |
| Experiment | `/api/experiments` | GET | Manager (farm-based) |
| Experiment | `/api/experiments/{id}` | GET | Manager (farm-based) |
| Experiment | `/api/experiments/{id}/stages` | GET | Manager (farm-based) |
| Experiment | `/api/experiments/{id}/groups` | GET | Manager (farm-based) |
| Experiment | `/api/experiments/{id}/design` | GET | Manager (farm-based) |
| Experiment | `/api/experiments/{id}/measurements` | GET | Manager (farm-based) |
| Experiment | `/api/experiments/{id}/schedules` | GET | Manager (farm-based) |
| Experiment | `/api/experiments/procedure-templates` | GET | Manager |
| Notification | `/api/notifications` | GET | Authenticated |
| Notification | `/api/notifications/unread-count` | GET | Authenticated |
| Notification | `/api/notifications/{id}/read` | PUT | Owner |
| Notification | `/api/notifications/read-all` | PUT | Authenticated |

---

## ⚠️ Lưu ý quan trọng cho FE

1. **Manager vs Admin**: Manager chỉ quản lý farm của mình. Admin có quyền truy cập tất cả.

2. **Batches Access**: Manager bị Forbid khi truy cập BatchesController. Không hiển thị chức năng liên quan đến Batches.

3. **Approve Logic**: Khi duyệt request, bắt buộc phải chọn ít nhất 1 bed từ `availableBeds` trong `resource-summary`.

4. **Response Format**: 
   - ExperimentsController: `ApiResponse<T>`
   - ExperimentRequestsController: Nhiều format khác nhau

5. **Date Format**: 
   - `DateOnly`: `yyyy-MM-dd`
   - `DateTime`: ISO 8601

---

**Version**: 1.1  
**Ngày tạo**: 28/06/2026  
**Backend**: SmartFarm SEP490 (.NET 8 + JWT + EF Core)