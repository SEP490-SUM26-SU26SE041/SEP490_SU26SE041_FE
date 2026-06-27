// Validation utilities & validators for Manager forms
// Returns error message (string) or null if valid

export const required = (msg = 'Trường này là bắt buộc') => (value) => {
  if (value === undefined || value === null) return msg;
  if (typeof value === 'string' && value.trim() === '') return msg;
  return null;
};

export const minLength = (n, msg) => (value) => {
  if (value === undefined || value === null || value === '') return null;
  const v = String(value).trim();
  if (v.length < n) return msg || `Tối thiểu ${n} ký tự`;
  return null;
};

export const maxLength = (n, msg) => (value) => {
  if (value === undefined || value === null || value === '') return null;
  const v = String(value).trim();
  if (v.length > n) return msg || `Tối đa ${n} ký tự`;
  return null;
};

// Business: code must be alphanumeric (uppercase + digits + hyphen/underscore)
export const codeFormat = (msg = 'Mã chỉ gồm chữ in hoa, số, gạch ngang hoặc gạch dưới (VD: FARM001, BED-A1)') => (value) => {
  if (!value) return null;
  const v = String(value).trim();
  if (!/^[A-Z0-9_-]+$/.test(v)) return msg;
  return null;
};

export const positiveNumber = (msg = 'Phải là số dương') => (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  if (Number.isNaN(n)) return 'Phải là số';
  if (n <= 0) return msg;
  return null;
};

export const nonNegativeNumber = (msg = 'Phải là số không âm') => (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  if (Number.isNaN(n)) return 'Phải là số';
  if (n < 0) return msg;
  return null;
};

export const maxValue = (n, msg) => (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  if (num > n) return msg || `Không được vượt quá ${n}`;
  return null;
};

export const minValue = (n, msg) => (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  if (num < n) return msg || `Không được nhỏ hơn ${n}`;
  return null;
};

// Date: yyyy-MM-dd, must be valid & not in the past
export const futureDate = (msg = 'Ngày phải ở tương lai') => (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Ngày không hợp lệ';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (d < today) return msg;
  return null;
};

export const validDate = (msg = 'Ngày không hợp lệ') => (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return msg;
  return null;
};

// Compare endDate > startDate (factory; needs form values)
export const dateAfter = (otherField, msg = 'Ngày kết thúc phải sau ngày bắt đầu') =>
  (value, allValues) => {
    if (!value || !allValues?.[otherField]) return null;
    const a = new Date(value);
    const b = new Date(allValues[otherField]);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
    if (a <= b) return msg;
    return null;
  };

// Min selection count for multi-select
export const minSelected = (n, msg = `Chọn tối thiểu ${n} mục`) => (value) => {
  if (!Array.isArray(value) || value.length < n) return msg;
  return null;
};

// Compose multiple validators for one field (run sequentially, stop on first error)
export const compose = (...validators) => (value, allValues) => {
  for (const v of validators) {
    if (typeof v !== 'function') continue;
    const err = v(value, allValues);
    if (err) return err;
  }
  return null;
};

// Run all validators on a whole form. schema = { fieldName: validatorFn | [fn1, fn2, ...] }
export const validateForm = (values, schema) => {
  const errors = {};
  for (const field of Object.keys(schema)) {
    const rules = schema[field];
    const arr = Array.isArray(rules) ? rules : [rules];
    for (const rule of arr) {
      if (typeof rule !== 'function') continue;
      const err = rule(values[field], values);
      if (err) {
        errors[field] = err;
        break;
      }
    }
  }
  return errors;
};

// Pre-defined schemas per Manager resource
export const schemas = {
  // 3.4 Tạo farm mới
  farm: {
    farmCode: compose(required('Mã nông trại là bắt buộc'), codeFormat(), maxLength(50)),
    farmName: compose(required('Tên nông trại là bắt buộc'), minLength(2), maxLength(100)),
    location: maxLength(200),
    description: maxLength(500)
  },

  // 4.1 Tạo Area
  area: {
    areaCode: compose(required('Mã khu vực là bắt buộc'), codeFormat(), maxLength(50)),
    areaName: compose(required('Tên khu vực là bắt buộc'), minLength(2), maxLength(100)),
    totalArea: compose(
      nonNegativeNumber('Diện tích phải là số không âm'),
      maxValue(1000000, 'Diện tích quá lớn')
    )
  },

  // 5.1 Tạo Bed
  bed: {
    bedCode: compose(required('Mã luống là bắt buộc'), codeFormat(), maxLength(50)),
    soilDescription: maxLength(500),
    length: compose(
      nonNegativeNumber('Chiều dài phải là số không âm'),
      maxValue(10000, 'Chiều dài quá lớn')
    ),
    width: compose(
      nonNegativeNumber('Chiều rộng phải là số không âm'),
      maxValue(10000, 'Chiều rộng quá lớn')
    )
  },

  // 7.3 Duyệt yêu cầu
  review: {
    comment: compose(maxLength(500), minLength(10, 'Lý do phải có ít nhất 10 ký tự'))
  }
};