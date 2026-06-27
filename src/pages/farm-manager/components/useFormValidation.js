import { useCallback, useMemo, useState } from 'react';
import { validateForm } from './validation';

// Generic form-validation hook
// Usage:
//   const { values, errors, touched, handleChange, handleBlur, validateAll, reset, setValues } =
//     useFormValidation(initialValues, schema);
//   <Input value={values.name} onChange={e => handleChange('name', e.target.value)} onBlur={() => handleBlur('name')} error={touched.name && errors.name} />
//
// Or use field shortcut:
//   const f = field('name'); // returns { value, onChange, onBlur, error }
export const useFormValidation = (initialValues, schema) => {
  const [values, setValues] = useState(initialValues);
  const [touched, setTouched] = useState({});

  const errors = useMemo(() => {
    const e = validateForm(values, schema || {});
    // strip empty errors so .error?. triggers cleanly
    const cleaned = {};
    for (const k of Object.keys(e)) if (e[k]) cleaned[k] = e[k];
    return cleaned;
  }, [values, schema]);

  const handleChange = useCallback((field, value) => {
    setValues(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleBlur = useCallback((field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  }, []);

  const setFieldError = useCallback((field, error) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    // We piggy-back by setting touched; consumer can override via custom logic
    // For backend errors, the parent will set errors via setErrors pattern if needed.
    if (!error) {
      // Mark as clean
      setTouched(prev => ({ ...prev, [field]: false }));
    }
  }, []);

  const validateAll = useCallback(() => {
    const all = validateForm(values, schema || {});
    const touchedAll = {};
    for (const k of Object.keys(all)) touchedAll[k] = true;
    setTouched(touchedAll);
    return Object.keys(all).length === 0;
  }, [values, schema]);

  const reset = useCallback((next = initialValues) => {
    setValues(next);
    setTouched({});
  }, [initialValues]);

  const showError = useCallback((field) => touched[field] ? errors[field] : undefined, [touched, errors]);

  const field = useCallback((name) => ({
    value: values[name] ?? '',
    onChange: (e) => handleChange(name, e?.target ? e.target.value : e),
    onBlur: () => handleBlur(name),
    error: showError(name)
  }), [values, handleChange, handleBlur, showError]);

  return {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    setFieldError,
    validateAll,
    reset,
    setValues,
    showError,
    field,
    isValid: Object.keys(errors).length === 0
  };
};