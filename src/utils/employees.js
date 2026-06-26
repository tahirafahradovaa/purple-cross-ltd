export const employeeFields = [
  'code',
  'fullName',
  'occupation',
  'department',
  'dateOfEmployment',
  'terminationDate',
];

export function createEmptyEmployee(nextCode = '') {
  return {
    code: nextCode,
    fullName: '',
    occupation: '',
    department: '',
    dateOfEmployment: '',
    terminationDate: '',
  };
}

export function normalizeEmployee(employee) {
  return {
    code: String(employee.code ?? '').trim(),
    fullName: String(employee.fullName ?? '').trim(),
    occupation: String(employee.occupation ?? '').trim(),
    department: String(employee.department ?? '').trim(),
    dateOfEmployment: employee.dateOfEmployment || '',
    terminationDate: employee.terminationDate || '',
  };
}

export function toDateOnly(value) {
  if (!value) return null;
  if (!isValidDateInput(value)) return null;

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value) {
  const date = toDateOnly(value);
  if (!date) return 'Not set';

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function employmentStatus(dateOfEmployment, today = new Date()) {
  const date = toDateOnly(dateOfEmployment);
  if (!date) return 'Missing start date';

  // The case study asks future employment dates to read as "Employed soon".
  return date > startOfToday(today) ? 'Employed soon' : 'Currently employed';
}

export function terminationStatus(terminationDate, today = new Date()) {
  const date = toDateOnly(terminationDate);
  if (!date) return 'No termination date';

  return date > startOfToday(today) ? 'To be terminated' : 'Terminated';
}

export function statusTone(label) {
  if (label === 'Currently employed') return 'positive';
  if (label === 'Employed soon' || label === 'To be terminated') return 'warning';
  if (label === 'Terminated') return 'danger';
  return 'neutral';
}

export function sortEmployees(employees, sortKey, direction) {
  const multiplier = direction === 'asc' ? 1 : -1;

  return [...employees].sort((left, right) => {
    const leftValue = left[sortKey] || '';
    const rightValue = right[sortKey] || '';

    if (sortKey === 'dateOfEmployment' || sortKey === 'terminationDate') {
      // Date columns are sorted chronologically, with empty dates placed last.
      return compareDates(leftValue, rightValue) * multiplier;
    }

    return String(leftValue).localeCompare(String(rightValue), undefined, {
      sensitivity: 'base',
      numeric: true,
    }) * multiplier;
  });
}

export function filterEmployees(employees, query, department, status, today = new Date()) {
  const normalizedQuery = query.trim().toLowerCase();

  return employees.filter((employee) => {
    const matchesQuery = !normalizedQuery || [
      employee.code,
      employee.fullName,
      employee.occupation,
      employee.department,
    ].some((value) => String(value).toLowerCase().includes(normalizedQuery));

    const matchesDepartment = department === 'All departments' || employee.department === department;
    const currentEmploymentStatus = employmentStatus(employee.dateOfEmployment, today);
    const currentTerminationStatus = terminationStatus(employee.terminationDate, today);
    const matchesStatus = status === 'All statuses'
      || currentEmploymentStatus === status
      || currentTerminationStatus === status;

    return matchesQuery && matchesDepartment && matchesStatus;
  });
}

export function validateEmployee(employee, existingEmployees, originalCode = '') {
  const errors = {};
  const normalized = normalizeEmployee(employee);

  if (!normalized.code) errors.code = 'Code is required.';
  if (!normalized.fullName) errors.fullName = 'Full name is required.';
  if (!normalized.occupation) errors.occupation = 'Occupation is required.';
  if (!normalized.department) errors.department = 'Department is required.';

  if (normalized.code && !/^[A-Za-z0-9-]+$/.test(normalized.code)) {
    errors.code = 'Use letters, numbers, and hyphens only.';
  }

  // During edits the original employee code is allowed; all other duplicates fail.
  const duplicate = existingEmployees.some((item) => (
    item.code.toLowerCase() === normalized.code.toLowerCase()
    && item.code.toLowerCase() !== originalCode.toLowerCase()
  ));
  if (duplicate) errors.code = 'This employee code already exists.';

  const employmentDate = toDateOnly(normalized.dateOfEmployment);
  const terminationDate = toDateOnly(normalized.terminationDate);

  if (normalized.dateOfEmployment && !isValidDateInput(normalized.dateOfEmployment)) {
    errors.dateOfEmployment = 'Enter a valid employment date.';
  }

  if (normalized.terminationDate && !isValidDateInput(normalized.terminationDate)) {
    errors.terminationDate = 'Enter a valid termination date.';
  }

  // A termination date before the start date is always invalid for employee records.
  if (employmentDate && terminationDate && terminationDate < employmentDate) {
    errors.terminationDate = 'Termination date cannot be before employment date.';
  }

  return errors;
}

export function nextEmployeeCode(employees) {
  const highest = employees.reduce((max, employee) => {
    const match = String(employee.code).match(/^EMP(\d+)$/i);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  return `EMP${String(highest + 1).padStart(3, '0')}`;
}

export function exportJson(employees) {
  return JSON.stringify(employees.map(normalizeEmployee), null, 2);
}

export function parseImportedEmployees(text) {
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) {
    throw new Error('Imported file must contain an array of employees.');
  }

  const employees = parsed.map((employee) => {
    const normalized = normalizeEmployee(employee);
    const missingField = employeeFields.find((field) => !(field in employee));

    if (missingField) {
      throw new Error(`Imported employee ${normalized.code || 'without code'} is missing ${missingField}.`);
    }

    return normalized;
  });

  const codes = new Set();
  for (const employee of employees) {
    const code = employee.code.toLowerCase();
    if (codes.has(code)) {
      throw new Error(`Imported file contains duplicate employee code ${employee.code}.`);
    }
    codes.add(code);
  }

  return employees;
}

function compareDates(left, right) {
  const leftDate = toDateOnly(left);
  const rightDate = toDateOnly(right);

  if (!leftDate && !rightDate) return 0;
  if (!leftDate) return 1;
  if (!rightDate) return -1;

  return leftDate.getTime() - rightDate.getTime();
}

function startOfToday(today) {
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

function isValidDateInput(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;

  const [year, month, day] = String(value).split('-').map(Number);
  const date = new Date(year, month - 1, day);

  // JavaScript rolls invalid dates forward, so compare the parts after parsing.
  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day;
}
