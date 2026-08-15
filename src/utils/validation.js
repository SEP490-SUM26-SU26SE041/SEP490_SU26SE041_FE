// Validation utilities dùng chung cho các form admin/researcher/technician/student.
// Mỗi validator trả về error message (string) hoặc null nếu hợp lệ.

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

// Email cơ bản (RFC-light, đủ dùng cho input form)
export const emailFormat = (msg = 'Email không hợp lệ') => (value) => {
  if (!value) return null;
  const v = String(value).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return msg;
  return null;
};

// Số điện thoại Việt Nam (10-11 chữ số, có thể +84)
export const phoneFormat = (msg = 'Số điện thoại không hợp lệ (10-11 chữ số)') => (value) => {
  if (!value) return null;
  const v = String(value).trim().replace(/[\s\-\.]/g, '');
  if (!/^(\+?84|0)?\d{9,10}$/.test(v)) return msg;
  return null;
};

// Mật khẩu: tối thiểu 8 ký tự, có chữ + số
export const passwordComplexity = (msg = 'Mật khẩu ≥ 8 ký tự, gồm chữ và số') => (value) => {
  if (!value) return null;
  const v = String(value);
  if (v.length < 8) return msg;
  if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return msg;
  return null;
};

export const positiveNumber = (msg = 'Phải là số dương (> 0)') => (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  if (Number.isNaN(n)) return 'Phải là số';
  if (n <= 0) return msg;
  return null;
};

export const nonNegativeNumber = (msg = 'Phải là số không âm (≥ 0)') => (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  if (Number.isNaN(n)) return 'Phải là số';
  if (n < 0) return msg;
  return null;
};

export const integer = (msg = 'Phải là số nguyên') => (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  if (Number.isNaN(n) || !Number.isInteger(n)) return msg;
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

// Ngày hợp lệ
export const validDate = (msg = 'Ngày không hợp lệ') => (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return msg;
  return null;
};

// Ngày trong tương lai (>= hôm nay)
export const futureDate = (msg = 'Ngày phải ở tương lai') => (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Ngày không hợp lệ';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (d < today) return msg;
  return null;
};

// Ngày trong quá khứ (<= hôm nay)
export const pastOrTodayDate = (msg = 'Ngày không được ở tương lai') => (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Ngày không hợp lệ';
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (d > today) return msg;
  return null;
};

// endDate > startDate
export const dateAfter = (otherField, msg = 'Ngày kết thúc phải sau ngày bắt đầu') =>
  (value, allValues) => {
    if (!value || !allValues?.[otherField]) return null;
    const a = new Date(value);
    const b = new Date(allValues[otherField]);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
    if (a <= b) return msg;
    return null;
  };

// Compose nhiều validator, chạy tuần tự, dừng khi gặp lỗi đầu tiên
export const compose = (...validators) => (value, allValues) => {
  for (const v of validators) {
    if (typeof v !== 'function') continue;
    const err = v(value, allValues);
    if (err) return err;
  }
  return null;
};

// Chạy toàn bộ schema. schema = { field: validator | [validator1, validator2, ...] }
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

// Helper kiểm tra errors có rỗng không
export const isValid = (errors) => errors && Object.keys(errors).length === 0;
