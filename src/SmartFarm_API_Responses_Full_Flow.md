# SPEC: Tổng hợp Response Luồng Farm → Experiment (BE mới cập nhật)

> **Mục đích**: FE review đảm bảo khai báo đầy đủ fields BE trả về sau khi pull main (gồm các commit `04b9dc6 Update randomization`, `1d52fe3 fix duedate + skillRequirements`, `5e57c63 restrict report`, `9092875 task overdue`, `fe55115 validate assignment`, ...).

---

## 0. Authentication (đăng nhập trước)

### POST /api/auth/login

**Response** (`LoginResponse`):
```json
{
  "token": "eyJhbGciOi...",
  "userId": "guid",
  "email": "user@example.com",
  "fullName": "Nguyen Van A",
  "roles": ["Researcher"],
  "expiresAt": "2026-08-08T10:00:00Z"
}
```

---

## 1. Bước 1: Quản lý Farm → Areas → Beds

### 1.1. POST /api/farms — Tạo Farm
**Response** (`FarmResponseDto`):
```json
{
  "id": "guid",
  "farmCode": "FARM001",
  "farmName": "Trai ABC",
  "location": "Ha Noi",
  "description": "Trai nghien cuu",
  "managerId": "guid",
  "managerName": "Nguyen Van Manager",
  "createdAt": "2026-08-01T10:00:00Z",
  "updatedAt": "2026-08-01T10:00:00Z",
  "areas": []
}
```

### 1.2. GET /api/farms/my-farms
**Response**: `List<FarmResponseDto>` (cùng shape trên, có sẵn `Areas`).

### 1.3. POST /api/farms/areas — Tạo Area
**Response** (`AreaResponseDto`):
```json
{
  "id": "guid",
  "areaCode": "AREA001",
  "areaName": "Khu A",
  "environmentType": "Greenhouse",
  "totalArea": 500.50,
  "status": "Available",
  "farmId": "guid",
  "createdAt": "...",
  "updatedAt": "...",
  "beds": []
}
```
> `status` enum: `Available | Occupied | Maintenance`

### 1.4. GET /api/farms/farms/{farmId}/areas
**Response**: `List<AreaResponseDto>`.

### 1.5. POST /api/farms/beds — Tạo Bed
**Response** (`BedResponseDto`):
```json
{
  "id": "guid",
  "bedCode": "BED-001",
  "soilDescription": "Dat pha cat",
  "length": 5.0,
  "width": 2.0,
  "allocationStatus": "Available",
  "areaId": "guid",
  "areaName": "Khu A",
  "farmId": "guid",
  "createdAt": "...",
  "updatedAt": "...",
  "assignments": []
}
```
> `allocationStatus` enum: `Available | Reserved | Assigned | Released`

### 1.6. GET /api/farms/areas/{areaId}/beds
**Response**: `List<BedResponseDto>`.

### 1.7. GET /api/farms/farms/{farmId}/beds/available
**Response**: `List<BedResponseDto>` (chỉ lấy bed `AllocationStatus = Available`).

---

## 2. Bước 2: Quản lý Crop & Varieties (Admin)

### 2.1. POST /api/crops — Tạo Crop
**Response** (`CropResponseDto`):
```json
{
  "id": "guid",
  "cropName": "Ca chua",
  "scientificName": "Solanum lycopersicum",
  "category": "Rau",
  "description": "...",
  "createdAt": "...",
  "varieties": []
}
```

### 2.2. POST /api/crops/varieties — Tạo Crop Variety
**Response** (`CropVarietyResponseDto`):
```json
{
  "id": "guid",
  "varietyName": "Ca chua Cherry",
  "origin": "Ha Lan",
  "growthDurationDays": 90,
  "description": "...",
  "cropId": "guid",
  "cropName": "Ca chua",
  "createdAt": "..."
}
```

### 2.3. GET /api/crops/crops/{cropId}/varieties
**Response**: `List<CropVarietyResponseDto>`.

---

## 3. Bước 3: Tạo Procedure Template

### 3.1. POST /api/experiments/procedure-templates
**Body** (`CreateProcedureTemplateDto`):
```json
{
  "cropVarietyId": "guid",
  "templateName": "Quy trinh trong ca chua",
  "objective": "...",
  "description": "...",
  "steps": [
    {
      "stepOrder": 1,
      "title": "Chuan bi dat",
      "instruction": "Lam dat toi xop",
      "expectedDurationDays": 7,
      "requiredSkillDescription": "Ky nang lam dat",
      "stageType": "Preparation"
    }
  ]
}
```
**Response** (`ProcedureTemplateResponseDto`):
```json
{
  "id": "guid",
  "templateName": "Quy trinh trong ca chua",
  "objective": "...",
  "description": "...",
  "cropVarietyId": "guid",
  "cropVarietyName": "Ca chua Cherry",
  "createdAt": "...",
  "steps": [
    {
      "id": "guid",
      "stepOrder": 1,
      "title": "Chuan bi dat",
      "instruction": "Lam dat toi xop",
      "expectedDurationDays": 7,
      "requiredSkillDescription": "Ky nang lam dat",
      "stageType": "Preparation"
    }
  ]
}
```

### 3.2. GET /api/experiments/procedure-templates?cropVarietyId={id}
**Response**: `List<ProcedureTemplateResponseDto>`.

---

## 4. Bước 4: Tạo Experiment Request

### 4.1. POST /api/experiment-requests
**Body** (`CreateExperimentRequestDto`):
```json
{
  "farmId": "guid",
  "cropVarietyId": "guid",
  "procedureTemplateId": "guid",
  "title": "Yeu cau TN tuoi nuoc thong minh",
  "objective": "Danh gia hieu qua tuoi tu dong",
  "expectedStartDate": "2026-08-15",
  "expectedEndDate": "2026-12-15",
  "monitoringPlan": "{\"designType\":\"RCBD\",\"replicationCount\":3,\"randomizationMethod\":\"CompletelyRandomized\",\"treatments\":[{\"name\":\"Control\",\"groupType\":\"Control\"},{\"name\":\"Treatment A\",\"groupType\":\"Treatment\"}]}"
}
```
> `monitoringPlan` parse sang `MonitoringPlanDto`:
```json
{
  "designType": "RCBD",
  "replicationCount": 3,
  "randomizationMethod": "CompletelyRandomized",
  "treatments": [
    { "name": "Control", "description": "...", "groupType": "Control" }
  ],
  "factorialFactors": null
}
```

**Response** (`{ success, message, data }`):
```json
{
  "success": true,
  "message": "Tao yeu cau thuc nghiem thanh cong.",
  "data": {
    "id": "guid",
    "title": "Yeu cau TN tuoi nuoc thong minh",
    "objective": "...",
    "status": "Pending",
    "expectedStartDate": "2026-08-15",
    "expectedEndDate": "2026-12-15",
    "monitoringPlan": "{\"designType\":...}",
    "createdAt": "...",
    "updatedAt": "...",
    "farmId": "guid",
    "farmName": "Trai ABC",
    "researcherId": "guid",
    "researcherName": "Nguyen Van Researcher",
    "cropVarietyId": "guid",
    "cropVarietyName": "Ca chua Cherry",
    "procedureTemplateId": "guid",
    "procedureTemplateName": "Quy trinh trong ca chua",
    "reviews": []
  }
}
```
> `status` enum: `Pending | Approved | Rejected | Cancelled`

### 4.2. GET /api/experiment-requests (Researcher/Manager)
**Response**: `List<ExperimentRequestResponseDto>` (cùng shape `data` ở trên).

### 4.3. GET /api/experiment-requests/{id}
**Response**: `ExperimentRequestResponseDto` (trực tiếp, không wrap `success/message`).

### 4.4. GET /api/experiment-requests/manager/inbox?status=Pending
**Response**:
```json
{
  "success": true,
  "message": "Lay danh sach hop thu thanh cong.",
  "data": [ { ...ExperimentRequestResponseDto... } ]
}
```

### 4.5. PUT /api/experiment-requests/{id} — Update (chỉ Pending)
**Body** (`UpdateExperimentRequestDto`): các field nullable.
**Response**:
```json
{ "success": true, "message": "Cap nhat yeu cau thanh cong.", "data": { ...ExperimentRequestResponseDto... } }
```

---

## 5. Bước 5: Manager Review Request

### 5.1. GET /api/experiment-requests/{id}/resource-summary?replicationCount=3&expectedGroups=2
**Response** (`ResourceValidationResultDto`):
```json
{
  "isValid": true,
  "sufficientBeds": true,
  "sufficientSensors": true,
  "requiredBeds": 6,
  "availableBedCount": 12,
  "message": "Farm 'Trai ABC' co 12/20 beds kha dung. Can 6 lo cho thuc nghiem.",
  "resources": {
    "farmId": "guid",
    "farmName": "Trai ABC",
    "totalBeds": 20,
    "availableBeds": 12,
    "inUseBeds": 5,
    "maintenanceBeds": 3,
    "totalSensors": 10,
    "totalAreas": 4
  },
  "availableBeds": [
    { "id": "guid", "bedCode": "BED-001", "allocationStatus": "Available", ... }
  ]
}
```

### 5.2. POST /api/experiment-requests/{id}/review — Manager duyệt
**Body** (`ReviewExperimentRequestDto`):
```json
{
  "result": "Approved",
  "comment": "Duyet, san sang beds."
}
```
> `result` enum: `Approved | Rejected`

**Response**:
```json
{
  "success": true,
  "message": "Duyet yeu cau thanh cong. He thong se tu dong chon beds.",
  "data": {
    "id": "guid",
    "reviewerId": "guid",
    "reviewer": {
      "id": "guid",
      "fullName": "Nguyen Van Manager",
      "email": "manager@example.com",
      "phone": "0901234567",
      "profileDescription": "...",
      "isActive": true,
      "createdAt": "...",
      "roles": ["Manager"]
    },
    "comment": "Duyet, san sang beds.",
    "result": "Approved",
    "reviewedAt": "2026-08-07T10:00:00Z"
  }
}
```

> Sau khi Approved, BE **tự động**:
> 1. Sinh treatment names từ `MonitoringPlan.Treatments` (hoặc factorial / default Control+Treatment)
> 2. Tính `requiredBeds = replicationCount * expectedGroups`
> 3. Shuffle available beds và **Reserved** số lượng `requiredBeds`
> 4. Trả `RequestStatus.Approved`

### 5.3. GET /api/experiment-requests/{id}/reserved-beds — Xem các bed đã Reserve
**Response** (`BedReservationResponseDto`):
```json
{
  "requestId": "guid",
  "reservedCount": 6,
  "reservedBeds": [
    {
      "id": "guid",
      "bedCode": "BED-001",
      "allocationStatus": "Reserved",
      "areaId": "guid",
      "areaName": "Khu A",
      "farmId": "guid",
      ...
    }
  ]
}
```

---

## 6. Bước 6: Tạo Experiment (từ Request đã Approved)

### 6.1. POST /api/experiments/from-request/{requestId}
**Response** (`ExperimentResponseDto` — QUAN TRỌNG, có nhiều field):
```json
{
  "id": "guid",
  "experimentCode": "EXP-20260807-A1B2C3D4",
  "title": "TN tuoi nuoc thong minh",
  "objective": "...",
  "hypothesis": "...",
  "status": "Active",
  "startDate": "2026-08-15",
  "endDate": "2026-12-15",
  "createdAt": "...",
  "updatedAt": "...",
  "requestId": "guid",
  "farmId": "guid",
  "farmName": "Trai ABC",
  "researcherId": "guid",
  "researcherName": "Nguyen Van Researcher",
  "cropVarietyId": "guid",
  "cropVarietyName": "Ca chua Cherry",
  "procedureTemplateId": "guid",
  "procedureTemplateName": "Quy trinh trong ca chua",
  "stages": [
    {
      "id": "guid",
      "stageName": "Chuan bi dat",
      "stageOrder": 1,
      "objective": "Lam dat toi xop",
      "startDate": null,
      "endDate": null,
      "resultSummary": null,
      "resultData": null,
      "createdAt": "...",
      "updatedAt": "...",
      "stageType": "Preparation"
    }
  ],
  "groups": [
    {
      "id": "guid",
      "groupName": "Control",
      "treatmentDescription": "Thu nghiem: Control",
      "groupType": "Control",
      "createdAt": "..."
    },
    {
      "id": "guid",
      "groupName": "Treatment A",
      "treatmentDescription": "Thu nghiem: Treatment A",
      "groupType": "Treatment",
      "createdAt": "..."
    }
  ],
  "measurementDefinitions": [],
  "design": {
    "id": "guid",
    "designType": "RCBD",
    "replicationCount": 3,
    "randomizationMethod": "CompletelyRandomized",
    "designParameters": "{\"treatments\":[\"Control\",\"Treatment A\"],\"designType\":\"RCBD\",\"replicationCount\":3,\"randomizationMethod\":\"CompletelyRandomized\"}"
  }
}
```
> `status` enum: `Active | Paused | Completed | Cancelled | Draft`

### 6.2. POST /api/experiments — Tạo Experiment thủ công
**Body** (`CreateExperimentDto`):
```json
{
  "requestId": null,
  "farmId": "guid",
  "cropVarietyId": "guid",
  "procedureTemplateId": "guid",
  "experimentCode": "EXP001",
  "title": "TN manual",
  "objective": "...",
  "hypothesis": "...",
  "startDate": "2026-08-15",
  "endDate": "2026-12-15"
}
```
> Nếu có `requestId`: phải là **Approved**, nếu không trả `400`.
> Nếu có `procedureTemplateId`: tự sinh Stages từ Steps của template.

**Response**: `ApiResponse<ExperimentResponseDto>`:
```json
{
  "success": true,
  "message": "Tao thuc nghiem thanh cong.",
  "data": { ...ExperimentResponseDto... }
}
```

### 6.3. GET /api/experiments/{id}
**Response**: `ExperimentResponseDto` (wrap trong `ApiResponse.data`).

### 6.4. PATCH /api/experiments/{id}/status
**Body** (`UpdateExperimentStatusDto`):
```json
{ "status": "Paused" }
```
**Response**: `ApiResponse<ExperimentResponseDto>`.

### 6.5. PUT /api/experiments/{id}
**Body** (`UpdateExperimentDto`): partial update.
**Response**: `ApiResponse<ExperimentResponseDto>`.

---

## 7. Bước 7: Auto-Setup Experiment (BE tự động sau khi tạo)

> BE **tự động gọi** `AutoSetupExperimentStructureAsync(experimentId)` ngay khi `CreateAsync`/`CreateFromRequestAsync` thành công.
> Hành động:
> 1. Tạo `ExperimentDesign` (parse từ `MonitoringPlan`).
> 2. Tạo `ExperimentGroups` (treatment names).
> 3. **Shuffle** bed assignments, gán `GroupId` + `ReplicateIndex` (1, 2, 3 → reset theo group).
> 4. Tạo `Batch` ứng với mỗi assignment.

### 7.1. POST /api/experiments/{id}/randomize — Randomize lại
**Response** (`RandomizationResultDto`):
```json
{
  "experimentId": "guid",
  "designType": "RCBD",
  "replicationCount": 3,
  "totalBedsAssigned": 6,
  "totalGroups": 2,
  "assignments": [
    {
      "groupId": "guid",
      "groupName": "Control",
      "replicateIndex": 1,
      "bedId": "guid",
      "bedCode": "BED-003"
    }
  ]
}
```

### 7.2. POST /api/experiments/{id}/supplement-groups — Bổ sung/sửa Groups
**Body** (`SupplementGroupsDto`):
```json
{
  "experimentId": "guid",
  "groups": [
    { "id": "guid", "groupName": "Control", "treatmentDescription": "...", "groupType": "Control" },
    { "id": null, "groupName": "Treatment B", "treatmentDescription": "...", "groupType": "Treatment" }
  ]
}
```
**Response**: `List<ExperimentGroupResponseDto>`.

---

## 8. Bước 8: Experiment Stages, Design, Measurements, Batches

### 8.1. GET /api/experiments/{experimentId}/stages
**Response**: `List<ExperimentStageResponseDto>`.

### 8.2. POST /api/experiments/{experimentId}/stages
**Body** (`CreateExperimentStageDto`):
```json
{
  "stageName": "Giai doan 1",
  "stageOrder": 1,
  "objective": "...",
  "startDate": "2026-08-15",
  "endDate": "2026-08-30",
  "stageType": "Preparation"
}
```
**Response**: `ApiResponse<ExperimentStageResponseDto>`.

### 8.3. GET /api/experiments/{experimentId}/design
**Response**: `ApiResponse<ExperimentDesignResponseDto>`.

### 8.4. POST /api/experiments/{experimentId}/design
**Body** (`CreateExperimentDesignDto`):
```json
{
  "designType": "RCBD",
  "replicationCount": 3,
  "randomizationMethod": "CompletelyRandomized",
  "designParameters": "{...}"
}
```
> `designType` enum: `CRD | RCBD | LSD | Factorial | SplitPlot | Other`
> `replicationCount` PHẢI >= 2.

### 8.5. GET /api/experiments/{experimentId}/measurements
**Response**: `List<MeasurementDefinitionResponseDto>`.

### 8.6. POST /api/experiments/{experimentId}/measurements
**Body**:
```json
{
  "groupId": "guid",
  "metricName": "Chieu cao cay",
  "unit": "cm",
  "targetValue": 50.0,
  "description": "Do tu goc den ngon"
}
```
**Response**: `MeasurementDefinitionResponseDto`:
```json
{
  "id": "guid",
  "groupId": "guid",
  "groupName": "Control",
  "metricName": "Chieu cao cay",
  "unit": "cm",
  "targetValue": 50.0,
  "description": "..."
}
```

### 8.7. GET /api/batches/experiments/{experimentId}
**Response**: `List<BatchResponseDto>` — **CẬP NHẬT MỚI**, có thêm `ExperimentBedAssignmentId`, `BedCode`, `AreaName`, `FarmName`:
```json
{
  "id": "guid",
  "batchCode": "Batch-BED-001-1",
  "plantingDate": null,
  "expectedHarvestDate": null,
  "plantCount": null,
  "notes": null,
  "status": null,
  "createdAt": "...",
  "experimentId": "guid",
  "experimentTitle": "TN tuoi nuoc thong minh",
  "experimentBedAssignmentId": "guid",
  "bedCode": "BED-001",
  "areaName": "Khu A",
  "farmName": "Trai ABC",
  "groupId": "guid",
  "groupName": "Control",
  "cropVarietyId": "guid",
  "cropVarietyName": "Ca chua Cherry"
}
```

### 8.8. GET /api/farms/experiments/{experimentId}/bed-assignments
**Response**: `List<ExperimentBedAssignmentResponseDto>`:
```json
{
  "id": "guid",
  "requestId": "guid",
  "experimentId": "guid",
  "experimentTitle": "TN tuoi nuoc thong minh",
  "bedId": "guid",
  "bedCode": "BED-001",
  "allocationStatus": "Assigned",
  "areaName": "Khu A",
  "farmName": "Trai ABC",
  "assignedFrom": "2026-08-15",
  "assignedTo": null,
  "purpose": null
}
```

---

## 9. Bước 9: Care Schedules

### 9.1. GET /api/experiments/{experimentId}/schedules
**Response**: `List<CareScheduleResponseDto>`:
```json
{
  "id": "guid",
  "title": "Tuoi nuoc buoi sang",
  "instruction": "Tuoi 500ml/cay",
  "taskType": "Watering",
  "frequencyDays": 1,
  "startDate": "2026-08-15",
  "endDate": "2026-10-15",
  "createdAt": "...",
  "experimentId": "guid",
  "experimentStageId": "guid",
  "experimentStageName": "Giai doan 1",
  "batchId": "guid",
  "batchCode": "Batch-BED-001-1"
}
```

### 9.2. POST /api/experiments/{experimentId}/schedules
**Body** (`CreateCareScheduleDto`):
```json
{
  "experimentStageId": "guid",
  "batchId": "guid",
  "title": "Tuoi nuoc",
  "instruction": "...",
  "taskType": "Watering",
  "frequencyDays": 1,
  "startDate": "2026-08-15",
  "endDate": "2026-10-15"
}
```
**Response**: `ApiResponse<CareScheduleResponseDto>`.

---

## 10. Bước 10: Tasks (luồng phụ, dùng cho Mobile)

### 10.1. POST /api/tasks — Tạo Task (CẬP NHẬT `skillRequirements`)
**Body** (cập nhật mới):
```json
{
  "experimentId": "guid",
  "experimentStageId": "guid",
  "batchId": "guid",
  "title": "Tuoi nuoc batch 1",
  "description": "...",
  "taskType": "Watering",
  "requiredSkillDescription": "Ky nang tuoi nuoc",
  "dueDate": "2026-08-05T08:00:00Z",
  "skillRequirements": [
    { "skillId": "guid", "requiredLevel": 2 }
  ]
}
```
**Response**: `TaskResponseDto` (xem mục 11.1).

### 10.2. GET /api/tasks/today — Mobile lấy task hôm nay
**Response**: `List<TaskResponseDto>`.

### 10.3. GET /api/tasks/my?status=Pending&batchId=...&experimentId=...
**Response**: `List<TaskResponseDto>`.

### 10.4. GET /api/tasks/researcher/created?scope=upcoming&upcomingDays=14
**Response**: `List<TaskResponseDto>`.

### 10.5. GET /api/tasks/{taskId}/skill-matches
**Response**: `List<UserDto>` matching skills.

---

## 11. Task Response — FULL Schema (chi tiết FE cần check)

### 11.1. TaskResponseDto
```json
{
  "id": "guid",
  "title": "Tuoi nuoc batch 1",
  "description": "...",
  "taskType": "Watering",
  "requiredSkillDescription": "Ky nang tuoi nuoc",
  "dueDate": "2026-08-05T08:00:00Z",
  "status": "Pending",
  "createdAt": "2026-08-01T10:00:00Z",
  "updatedAt": "2026-08-01T10:00:00Z",
  "experimentId": "guid",
  "experimentTitle": "TN tuoi nuoc thong minh",
  "experimentCode": "EXP-20260807-A1B2C3D4",
  "experimentStageId": "guid",
  "experimentStageName": "Giai doan 1",
  "batchId": "guid",
  "batchCode": "Batch-BED-001-1",
  "careScheduleId": "guid",
  "careScheduleTitle": "Tuoi nuoc buoi sang",
  "createdBy": "guid",
  "createdByName": "Nguyen Van Researcher",
  "assignedTo": "guid",
  "assignedToName": "Tran Van Student",
  "skillRequirements": [
    {
      "skillId": "guid",
      "skillName": "Tuoi nuoc",
      "requiredLevel": 2
    }
  ],
  "assignments": [
    {
      "id": "guid",
      "taskId": "guid",
      "taskTitle": "Tuoi nuoc batch 1",
      "assigneeId": "guid",
      "assigneeName": "Tran Van Student",
      "assigneeEmail": "student@example.com",
      "assigneeRole": "Student",
      "assigneeSkills": [
        { "skillId": "guid", "skillName": "Tuoi nuoc", "proficiencyLevel": 3 }
      ],
      "assignedBy": "guid",
      "assignedByName": "Nguyen Van Researcher",
      "reason": "Can nguoi co ky nang tuoi nuoc",
      "status": "Assigned",
      "assignedAt": "2026-08-01T11:00:00Z",
      "endedAt": null
    }
  ]
}
```

### 11.2. Task Status Flow & Transitions
```
Pending → Assigned → InProgress → Completed → Approved
                          ↓
                       Overdue (auto)         ↓
                                          Rejected (← loop)
```
> Sau commit `9092875 add message can not start when task overdue`: Server **từ chối Start** task nếu đã quá hạn (`dueDate < now`) → trả `400 BadRequest`.
> Sau commit `5e57c63 can not send report if had one report before`: 1 task chỉ có **1 report duy nhất**, gửi report thứ 2 → lỗi.
> Sau commit `fe55115 Validate task`: Validate trước khi assign (task phải Pending, user phải tồn tại, v.v.).

---

## 12. TaskReports & TaskImages (Mobile báo cáo)

### 12.1. POST /api/task-reports
**Body**:
```json
{
  "taskId": "guid",
  "reportText": "Da tuoi nuoc cho 50 cay",
  "resultData": {
    "plantsWatered": 50,
    "condition": "Tot"
  }
}
```
**Response** (`TaskReportResponseDto`):
```json
{
  "id": "guid",
  "taskId": "guid",
  "taskTitle": "Tuoi nuoc batch 1",
  "reporterId": "guid",
  "reporterName": "Tran Van Student",
  "reportText": "Da tuoi nuoc cho 50 cay",
  "resultData": { "plantsWatered": 50, "condition": "Tot" },
  "reportedAt": "2026-08-03T10:30:00Z",
  "images": []
}
```
> **CHÚ Ý**: Nếu task đã có report → trả lỗi (sau commit `5e57c63`).

### 12.2. POST /api/task-images
**Body (multipart)**:
- `experimentId`, `batchId`, `taskReportId`, `imageUrl`, `caption`, `capturedAt`

**Response** (`TaskImageResponseDto`):
```json
{
  "id": "guid",
  "experimentId": "guid",
  "batchId": "guid",
  "batchCode": "Batch-BED-001-1",
  "taskReportId": "guid",
  "imageUrl": "https://storage.example.com/growth-001.jpg",
  "caption": "Ghi nhan tang truong",
  "uploadedBy": "guid",
  "uploadedByName": "Tran Van Student",
  "capturedAt": "2026-08-03T10:30:00Z",
  "createdAt": "..."
}
```

### 12.3. GET /api/task-images/report/{reportId}
**Response**: `List<TaskImageResponseDto>`.

### 12.4. GET /api/task-images/batch/{batchId}
**Response**: `List<TaskImageResponseDto>`.

---

## 13. Measurement Records

### 13.1. POST /api/measurement-records
**Body**:
```json
{
  "experimentId": "guid",
  "experimentStageId": "guid",
  "batchId": "guid",
  "measurementDefinitionId": "guid",
  "value": 25.5,
  "textValue": "Chieu cao trung binh",
  "measuredAt": "2026-08-10T09:00:00Z"
}
```
**Response** (`MeasurementRecordResponseDto`):
```json
{
  "id": "guid",
  "experimentId": "guid",
  "experimentStageId": "guid",
  "batchId": "guid",
  "measurementDefinitionId": "guid",
  "value": 25.5,
  "textValue": "Chieu cao trung binh",
  "measuredAt": "...",
  "measuredBy": "guid",
  "measuredByName": "Tran Van Student"
}
```

### 13.2. GET /api/measurement-records/batch/{batchId}
**Response**: `List<MeasurementRecordResponseDto>`.

---

## 14. Tóm tắt Enums cho FE

| Enum | Values |
|------|--------|
| `ExperimentStatus` | `Active`, `Paused`, `Completed`, `Cancelled`, `Draft` |
| `RequestStatus` | `Pending`, `Approved`, `Rejected`, `Cancelled` |
| `ReviewResult` | `Approved`, `Rejected` |
| `LocationStatus` (Area) | `Available`, `Occupied`, `Maintenance` |
| `AllocationStatus` (Bed) | `Available`, `Reserved`, `Assigned`, `Released` |
| `GroupType` | `Control`, `Treatment` |
| `DesignType` | `CRD`, `RCBD`, `LSD`, `Factorial`, `SplitPlot`, `Other` |
| `TaskType` | `Planting`, `Watering`, `Fertilizing`, `Observation`, `Inspection`, `Harvest`, `Other` |
| `TaskStatus` | `Pending`, `Assigned`, `InProgress`, `Completed`, `Approved`, `Rejected`, `Overdue`, `Cancelled`, `Resigned`, `Reassigned` |
| `ExperimentStageType` | `Preparation`, `Planting`, `Growing`, `Harvesting`, `PostHarvest`, `Other` |

---

## 15. Checklist Review cho FE

Khi review UI, đảm bảo các trang/màn hình hiển thị đủ các field sau:

### [x] Trang Experiment Detail (Researcher)
- [ ] `experimentCode`, `title`, `objective`, `hypothesis`, `status`, `startDate`, `endDate`
- [ ] `farmName`, `researcherName`, `cropVarietyName`, `procedureTemplateName`
- [ ] Tabs/sub-sections: `stages[]`, `groups[]`, `measurementDefinitions[]`, `design`

### [x] Trang Experiment Detail (Manager/Student)
- [ ] Các field trên
- [ ] `stages` với `resultSummary`, `resultData`

### [x] Trang Bed Assignment
- [ ] Hiển thị: `bedCode`, `areaName`, `farmName`, `allocationStatus`
- [ ] `experimentTitle`, `experimentId` (nếu có)

### [x] Trang Batch Detail
- [ ] `batchCode`, `bedCode`, `areaName`, `farmName`, `groupName`, `cropVarietyName`
- [ ] `experimentBedAssignmentId` (mới thêm sau pull main)

### [x] Trang Experiment Request Detail
- [ ] `monitoringPlan` (raw JSON — cần parse để hiển thị designType, replicationCount, treatments)
- [ ] `reviews[]` với `reviewer.fullName`, `comment`, `result`, `reviewedAt`

### [x] Trang Manager Review
- [ ] `/resource-summary`: `requiredBeds`, `availableBedCount`, `resources.totalBeds`
- [ ] `/reserved-beds`: `reservedBeds[]` với `allocationStatus = Reserved`

### [x] Trang Task Detail (Mobile)
- [ ] `skillRequirements[]` (mới thêm sau commit `1d52fe3`)
- [ ] `assignments[]` với `assigneeSkills[].proficiencyLevel`
- [ ] Validate phía client: nếu `dueDate < now` → disable nút Start

### [x] Trang Task Report (Mobile)
- [ ] Sau khi đã submit 1 report → disable nút Submit
- [ ] Hiển thị `images[]` với `imageUrl`, `caption`, `capturedAt`

### [x] Trang Procedure Template Detail
- [ ] `steps[]` với `stageType`, `expectedDurationDays`, `requiredSkillDescription`