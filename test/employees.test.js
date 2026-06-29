import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  employmentStatus,
  exportCsv,
  filterEmployees,
  formatDate,
  nextEmployeeCode,
  normalizeEmployee,
  parseImportedEmployees,
  sortEmployees,
  terminationStatus,
  validateEmployee,
} from '../src/utils/employees.js';

const existingEmployees = [
  {
    code: 'EMP001',
    fullName: 'Nicole Berry',
    occupation: 'IT Support',
    department: 'Research',
    dateOfEmployment: '2020-01-10',
    terminationDate: '',
  },
  {
    code: 'EMP002',
    fullName: 'Dustin Fisher',
    occupation: 'Pharmacist',
    department: 'Quality Assurance',
    dateOfEmployment: '2025-01-10',
    terminationDate: '2027-04-10',
  },
];

const validEmployee = {
  code: 'EMP003',
  fullName: 'Megan Smith',
  occupation: 'Lab Technician',
  department: 'Production',
  dateOfEmployment: '2024-03-01',
  terminationDate: '',
};

describe('employee validation', () => {
  it('requires the mandatory employee fields', () => {
    const errors = validateEmployee({
      code: '',
      fullName: '',
      occupation: '',
      department: '',
      dateOfEmployment: '',
      terminationDate: '',
    }, existingEmployees);

    assert.deepEqual(errors, {
      code: 'Code is required.',
      fullName: 'Full name is required.',
      occupation: 'Occupation is required.',
      department: 'Department is required.',
    });
  });

  it('rejects invalid employee codes', () => {
    const errors = validateEmployee({
      ...validEmployee,
      code: 'EMP 003',
    }, existingEmployees);

    assert.equal(errors.code, 'Use letters, numbers, and hyphens only.');
  });

  it('rejects duplicate employee codes case-insensitively', () => {
    const errors = validateEmployee({
      ...validEmployee,
      code: 'emp001',
    }, existingEmployees);

    assert.equal(errors.code, 'This employee code already exists.');
  });

  it('allows an edited employee to keep its original code', () => {
    const errors = validateEmployee({
      ...validEmployee,
      code: 'EMP001',
    }, existingEmployees, 'EMP001');

    assert.deepEqual(errors, {});
  });

  it('rejects impossible calendar dates', () => {
    const errors = validateEmployee({
      ...validEmployee,
      dateOfEmployment: '2024-02-31',
    }, existingEmployees);

    assert.equal(errors.dateOfEmployment, 'Enter a valid employment date.');
  });

  it('rejects termination dates before employment dates', () => {
    const errors = validateEmployee({
      ...validEmployee,
      dateOfEmployment: '2024-03-01',
      terminationDate: '2024-02-29',
    }, existingEmployees);

    assert.equal(errors.terminationDate, 'Termination date cannot be before employment date.');
  });

  it('accepts a complete valid employee', () => {
    assert.deepEqual(validateEmployee(validEmployee, existingEmployees), {});
  });
});

describe('employee import parsing', () => {
  it('requires imported content to be an array', () => {
    assert.throws(
      () => parseImportedEmployees(JSON.stringify({ employee: validEmployee })),
      /array of employees/,
    );
  });

  it('rejects employees missing expected fields', () => {
    const { department, ...employeeWithoutDepartment } = validEmployee;

    assert.throws(
      () => parseImportedEmployees(JSON.stringify([employeeWithoutDepartment])),
      /missing department/,
    );
    assert.equal(department, 'Production');
  });

  it('rejects imported employees with unsupported extra fields', () => {
    assert.throws(
      () => parseImportedEmployees(JSON.stringify([{
        ...validEmployee,
        salary: 50000,
      }])),
      /unsupported field salary/,
    );
  });

  it('rejects imported employees with invalid field types', () => {
    assert.throws(
      () => parseImportedEmployees(JSON.stringify([{
        ...validEmployee,
        code: 3,
      }])),
      /field code must be text/,
    );

    assert.throws(
      () => parseImportedEmployees(JSON.stringify([{
        ...validEmployee,
        terminationDate: 20240101,
      }])),
      /field terminationDate must be text or null/,
    );
  });

  it('rejects duplicate imported employee codes', () => {
    assert.throws(
      () => parseImportedEmployees(JSON.stringify([
        validEmployee,
        { ...validEmployee, fullName: 'Duplicate Employee' },
      ])),
      /duplicate employee code EMP003/,
    );
  });

  it('rejects duplicate imported employee codes after trimming and case normalization', () => {
    assert.throws(
      () => parseImportedEmployees(JSON.stringify([
        { ...validEmployee, code: ' EMP003 ' },
        { ...validEmployee, code: 'emp003', fullName: 'Duplicate Employee' },
      ])),
      /duplicate employee code emp003/,
    );
  });

  it('normalizes valid imported employees', () => {
    const [employee] = parseImportedEmployees(JSON.stringify([{
      ...validEmployee,
      code: ' EMP004 ',
      fullName: '  Alan Anderson ',
      terminationDate: null,
    }]));

    assert.equal(employee.code, 'EMP004');
    assert.equal(employee.fullName, 'Alan Anderson');
    assert.equal(employee.terminationDate, '');
  });
});

describe('employee export formatting', () => {
  it('exports spreadsheet-friendly CSV with employee headers', () => {
    const csv = exportCsv([validEmployee]);

    assert.equal(
      csv,
      [
        'Code,Full Name,Occupation,Department,Date of Employment,Termination Date',
        'EMP003,Megan Smith,Lab Technician,Production,2024-03-01,',
      ].join('\n'),
    );
  });

  it('escapes CSV cells that contain commas and quotes', () => {
    const csv = exportCsv([{
      ...validEmployee,
      fullName: 'Parker, "Tess"',
      department: 'Quality Assurance',
    }]);

    assert.match(csv, /"Parker, ""Tess"""/);
  });
});

describe('employee table helpers', () => {
  it('labels employment and termination dates relative to today', () => {
    const today = new Date('2026-06-26T12:00:00');

    assert.equal(employmentStatus('2026-06-27', today), 'Employed soon');
    assert.equal(employmentStatus('2026-06-26', today), 'Currently employed');
    assert.equal(terminationStatus('2026-06-27', today), 'To be terminated');
    assert.equal(terminationStatus('2026-06-25', today), 'Terminated');
    assert.equal(terminationStatus('', today), 'No termination date');
  });

  it('filters by query, department, and status', () => {
    const today = new Date('2026-06-26T12:00:00');
    const result = filterEmployees(existingEmployees, 'pharmacist', 'Quality Assurance', 'To be terminated', today);

    assert.equal(result.length, 1);
    assert.equal(result[0].code, 'EMP002');
  });

  it('sorts dates with empty dates last', () => {
    const result = sortEmployees(existingEmployees, 'terminationDate', 'asc');

    assert.equal(result[0].code, 'EMP002');
    assert.equal(result[1].code, 'EMP001');
  });

  it('generates the next employee code', () => {
    assert.equal(nextEmployeeCode(existingEmployees), 'EMP003');
  });

  it('formats empty dates as not set', () => {
    assert.equal(formatDate(''), 'Not set');
  });

  it('normalizes employee text values', () => {
    const employee = normalizeEmployee({
      ...validEmployee,
      code: ' EMP010 ',
      fullName: ' Jane Doe ',
    });

    assert.equal(employee.code, 'EMP010');
    assert.equal(employee.fullName, 'Jane Doe');
  });
});
