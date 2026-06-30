<script setup>
import { computed, reactive, ref } from 'vue';
import employeesSeed from '../purple_cross_employees.json';
import {
  createEmptyEmployee,
  exportCsv,
  employmentStatus,
  exportJson,
  filterEmployees,
  formatDate,
  nextEmployeeCode,
  normalizeEmployee,
  parseImportedEmployees,
  sortEmployees,
  statusTone,
  terminationStatus,
  validateEmployee,
} from './utils/employees';
import {
  clearStoredSession,
  createSessionUser,
  readStoredSession,
  validateLogin,
  writeStoredSession,
} from './utils/auth';

const employees = ref(employeesSeed.map(normalizeEmployee));
const query = ref('');
const departmentFilter = ref('All departments');
const statusFilter = ref('All statuses');
const sortKey = ref('fullName');
const sortDirection = ref('asc');
const page = ref(1);
const pageSize = ref(10);
const selectedEmployee = ref(null);
const mode = ref('list');
const form = reactive(createEmptyEmployee());
const formErrors = ref({});
const originalCode = ref('');
const confirmDelete = ref(null);
const importError = ref('');
const importInput = ref(null);
const showImportDialog = ref(false);
const importText = ref('');
const importFileName = ref('');
const isDraggingImport = ref(false);
const showExportDialog = ref(false);
const exportFormat = ref('json');
const exportScope = ref('all');
const toasts = ref([]);
const appVersion = '1.0.1';
const storedSession = readStoredSession(window.localStorage);
const isAuthenticated = ref(Boolean(storedSession));
const loginError = ref('');
const currentUser = ref(storedSession || {
  name: 'Admin Manager',
  email: 'admin@purplecross.test',
});
const loginForm = reactive({
  email: 'admin@purplecross.test',
  password: 'purplecross',
});

const columns = [
  { key: 'fullName', label: 'Full name' },
  { key: 'occupation', label: 'Occupation' },
  { key: 'department', label: 'Department' },
  { key: 'dateOfEmployment', label: 'Employment' },
  { key: 'terminationDate', label: 'Termination' },
];

const departments = computed(() => [
  'All departments',
  ...new Set(employees.value.map((employee) => employee.department).filter(Boolean).sort()),
]);

const statuses = [
  'All statuses',
  'Currently employed',
  'Employed soon',
  'To be terminated',
  'Terminated',
  'No termination date',
];

const importExample = JSON.stringify([
  {
    code: 'EMP001',
    fullName: 'Nicole Berry',
    occupation: 'IT Support',
    department: 'Research',
    dateOfEmployment: '2016-07-06',
    terminationDate: null,
  },
], null, 2);

const filteredEmployees = computed(() => filterEmployees(
  employees.value,
  query.value,
  departmentFilter.value,
  statusFilter.value,
));

const sortedEmployees = computed(() => sortEmployees(
  filteredEmployees.value,
  sortKey.value,
  sortDirection.value,
));

const totalPages = computed(() => Math.max(1, Math.ceil(sortedEmployees.value.length / pageSize.value)));

const pagedEmployees = computed(() => {
  if (page.value > totalPages.value) page.value = totalPages.value;
  const start = (page.value - 1) * pageSize.value;
  return sortedEmployees.value.slice(start, start + pageSize.value);
});

const hasActiveFilters = computed(() => (
  query.value.trim()
  || departmentFilter.value !== 'All departments'
  || statusFilter.value !== 'All statuses'
));

const metrics = computed(() => {
  // Active headcount excludes people whose termination date has already passed.
  const active = employees.value.filter((employee) => (
    employmentStatus(employee.dateOfEmployment) === 'Currently employed'
    && terminationStatus(employee.terminationDate) !== 'Terminated'
  )).length;

  return {
    total: employees.value.length,
    active,
    upcoming: employees.value.filter((employee) => employmentStatus(employee.dateOfEmployment) === 'Employed soon').length,
    exiting: employees.value.filter((employee) => terminationStatus(employee.terminationDate) === 'To be terminated').length,
  };
});

const userInitials = computed(() => currentUser.value.name
  .split(' ')
  .filter(Boolean)
  .map((part) => part[0])
  .join('')
  .slice(0, 2)
  .toUpperCase());

function login() {
  loginError.value = validateLogin(loginForm);

  if (loginError.value) {
    addToast('error', loginError.value);
    return;
  }

  currentUser.value = createSessionUser(loginForm.email);
  writeStoredSession(window.localStorage, currentUser.value);
  isAuthenticated.value = true;
  addToast('success', `Signed in as ${currentUser.value.name}.`);
}

function logout() {
  // Clear transient UI state so the next session starts from the dashboard list.
  closePanel();
  confirmDelete.value = null;
  clearStoredSession(window.localStorage);
  isAuthenticated.value = false;
  addToast('success', 'Signed out successfully.');
}

function setSort(key) {
  if (sortKey.value === key) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
    return;
  }

  sortKey.value = key;
  sortDirection.value = 'asc';
}

function resetPaging() {
  page.value = 1;
}

function clearFilters() {
  query.value = '';
  departmentFilter.value = 'All departments';
  statusFilter.value = 'All statuses';
  resetPaging();
  addToast('success', 'Filters cleared.');
}

function clearDepartmentFilter() {
  departmentFilter.value = 'All departments';
  resetPaging();
}

function clearStatusFilter() {
  statusFilter.value = 'All statuses';
  resetPaging();
}

function openCreate() {
  Object.assign(form, createEmptyEmployee(nextEmployeeCode(employees.value)));
  originalCode.value = '';
  formErrors.value = {};
  selectedEmployee.value = null;
  mode.value = 'create';
}

function openView(employee) {
  selectedEmployee.value = employee;
  mode.value = 'view';
}

function openEdit(employee) {
  Object.assign(form, { ...employee });
  // Preserve the original code so editing does not trigger duplicate-code validation.
  originalCode.value = employee.code;
  selectedEmployee.value = employee;
  formErrors.value = {};
  mode.value = 'edit';
}

function closePanel() {
  selectedEmployee.value = null;
  formErrors.value = {};
  mode.value = 'list';
}

function saveEmployee() {
  const errors = validateEmployee(form, employees.value, originalCode.value);
  formErrors.value = errors;

  if (Object.keys(errors).length > 0) {
    addToast('error', 'Please correct the highlighted employee fields.');
    return;
  }

  const normalized = normalizeEmployee(form);

  if (mode.value === 'edit') {
    // Replace by the original immutable key in case the employee code was edited.
    employees.value = employees.value.map((employee) => (
      employee.code === originalCode.value ? normalized : employee
    ));
    selectedEmployee.value = normalized;
    addToast('success', `${normalized.fullName} was updated.`);
  } else {
    employees.value = [...employees.value, normalized];
    selectedEmployee.value = normalized;
    addToast('success', `${normalized.fullName} was created.`);
  }

  mode.value = 'view';
  resetPaging();
}

function askDelete(employee) {
  confirmDelete.value = employee;
}

function deleteEmployee() {
  if (!confirmDelete.value) return;

  const deletedName = confirmDelete.value.fullName;
  employees.value = employees.value.filter((employee) => employee.code !== confirmDelete.value.code);
  if (selectedEmployee.value?.code === confirmDelete.value.code) closePanel();
  confirmDelete.value = null;
  resetPaging();
  addToast('success', `${deletedName} was removed.`);
}

function openExportDialog() {
  exportFormat.value = 'json';
  // If the user has narrowed the grid, default to exporting the view they are looking at.
  exportScope.value = hasActiveFilters.value ? 'filtered' : 'all';
  showExportDialog.value = true;
}

function closeExportDialog() {
  showExportDialog.value = false;
}

function downloadEmployees() {
  // Keep filtered exports aligned with the current sorted grid, not only raw filter matches.
  const source = exportScope.value === 'filtered' ? sortedEmployees.value : employees.value;
  const isJson = exportFormat.value === 'json';
  const content = isJson ? exportJson(source) : exportCsv(source);
  const blob = new Blob([content], { type: isJson ? 'application/json' : 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const scopeLabel = exportScope.value === 'filtered' ? 'filtered' : 'full';

  anchor.href = url;
  anchor.download = `purple_cross_employees_${scopeLabel}_export.${isJson ? 'json' : 'csv'}`;
  anchor.click();
  URL.revokeObjectURL(url);
  closeExportDialog();
  addToast('success', `Exported ${source.length} employees as ${isJson ? 'JSON' : 'CSV'}.`);
}

function openImportDialog() {
  importError.value = '';
  importText.value = '';
  importFileName.value = '';
  isDraggingImport.value = false;
  showImportDialog.value = true;
}

function closeImportDialog() {
  importError.value = '';
  importText.value = '';
  importFileName.value = '';
  isDraggingImport.value = false;
  showImportDialog.value = false;
}

async function readImportFile(file) {
  if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json') {
    throw new Error('Choose a .json file or paste JSON into the import box.');
  }

  importFileName.value = file.name;
  importText.value = await file.text();
  importError.value = '';
}

async function loadImportFile(event) {
  const [file] = event.target.files || [];
  if (!file) return;

  await handleImportFile(file);
  event.target.value = '';
}

async function dropImportFile(event) {
  isDraggingImport.value = false;
  const [file] = event.dataTransfer?.files || [];
  if (!file) return;

  await handleImportFile(file);
}

async function handleImportFile(file) {
  try {
    await readImportFile(file);
  } catch (error) {
    importError.value = error.message || 'Could not read the selected file.';
    addToast('error', importError.value);
  }
}

function importEmployees() {
  try {
    if (!importText.value.trim()) {
      throw new Error('Paste JSON or choose a JSON file before importing.');
    }

    const imported = parseImportedEmployees(importText.value);
    // Imports append to the current list and go through the same rules as manual entry.
    const validationErrors = imported
      .map((employee) => validateEmployee(employee, employees.value))
      .filter((errors) => Object.keys(errors).length > 0);

    if (validationErrors.length) {
      throw new Error('Imported employees contain invalid fields or codes that already exist.');
    }

    employees.value = [...employees.value, ...imported];
    closePanel();
    resetPaging();
    closeImportDialog();
    addToast('success', `Added ${imported.length} employees.`);
  } catch (error) {
    importError.value = error.message || 'Could not import employees.';
    addToast('error', importError.value);
  }
}

function addToast(type, message) {
  const id = Date.now() + Math.random();
  toasts.value = [...toasts.value, { id, type, message }];
  window.setTimeout(() => removeToast(id), 4200);
}

function removeToast(id) {
  toasts.value = toasts.value.filter((toast) => toast.id !== id);
}
</script>

<template>
  <section v-if="!isAuthenticated" class="login-screen" aria-labelledby="login-title">
    <div class="login-brand">
      <p class="eyebrow">Purple Cross Ltd</p>
      <h1 id="login-title">Employee Management</h1>
      <p>
        Sign in to manage employee records, employment dates, termination status,
        and HR data imports.
      </p>
    </div>

    <form class="login-panel" novalidate @submit.prevent="login">
      <p class="eyebrow">Secure access</p>
      <h2>Sign in</h2>

      <label>
        <span>Email</span>
        <input
          v-model="loginForm.email"
          autocomplete="email"
          inputmode="email"
          type="email"
        />
      </label>

      <label>
        <span>Password</span>
        <input
          v-model="loginForm.password"
          autocomplete="current-password"
          type="password"
        />
      </label>

      <p v-if="loginError" class="inline-error">{{ loginError }}</p>

      <button class="primary login-submit" type="submit">Sign in</button>
      <span class="version-label">Version {{ appVersion }}</span>
    </form>
  </section>

  <main v-else class="app-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">Purple Cross Ltd</p>
        <h1>Employee Management</h1>
        <span class="version-label">Version {{ appVersion }}</span>
      </div>
      <div class="user-badge" aria-label="Logged in user">
        <span class="avatar">{{ userInitials }}</span>
        <span>{{ currentUser.name }}</span>
        <button class="secondary compact" type="button" @click="logout">Logout</button>
      </div>
    </header>

    <nav class="module-nav" aria-label="Employee module navigation">
      <a href="#summary" class="active">Summary</a>
      <a href="#employees">Employees</a>
    </nav>

    <section class="taskbar" aria-label="Employee task bar">
      <div>
        <span>{{ sortedEmployees.length }} records shown</span>
        <strong>{{ hasActiveFilters ? 'Filters active' : 'No active filters' }}</strong>
      </div>
      <button class="secondary compact" type="button" :disabled="!hasActiveFilters" @click="clearFilters">
        Clear filters
      </button>
    </section>

    <section id="summary" class="metrics" aria-label="Employee summary">
      <article>
        <span>Total employees</span>
        <strong>{{ metrics.total }}</strong>
      </article>
      <article>
        <span>Currently active</span>
        <strong>{{ metrics.active }}</strong>
      </article>
      <article>
        <span>Starting soon</span>
        <strong>{{ metrics.upcoming }}</strong>
      </article>
      <article>
        <span>Upcoming exits</span>
        <strong>{{ metrics.exiting }}</strong>
      </article>
    </section>

    <section class="toolbar" aria-label="Employee filters">
      <label>
        <span>Search</span>
        <input
          v-model="query"
          type="search"
          placeholder="Search name, code, role..."
          @input="resetPaging"
        />
      </label>

      <div class="filter-field">
        <span>Department</span>
        <div :class="['select-clear', { active: departmentFilter !== 'All departments' }]">
          <select v-model="departmentFilter" @change="resetPaging">
            <option v-for="department in departments" :key="department" :value="department">
              {{ department }}
            </option>
          </select>
          <button
            v-if="departmentFilter !== 'All departments'"
            class="clear-select"
            type="button"
            aria-label="Clear department filter"
            @click="clearDepartmentFilter"
          >
            x
          </button>
        </div>
      </div>

      <div class="filter-field">
        <span>Status</span>
        <div :class="['select-clear', { active: statusFilter !== 'All statuses' }]">
          <select v-model="statusFilter" @change="resetPaging">
            <option v-for="status in statuses" :key="status" :value="status">
              {{ status }}
            </option>
          </select>
          <button
            v-if="statusFilter !== 'All statuses'"
            class="clear-select"
            type="button"
            aria-label="Clear status filter"
            @click="clearStatusFilter"
          >
            x
          </button>
        </div>
      </div>

      <div class="toolbar-actions">
        <span>Data</span>
        <input
          ref="importInput"
          class="visually-hidden"
          type="file"
          accept="application/json"
          @change="loadImportFile"
        />
        <div class="toolbar-button-row">
          <button class="secondary" type="button" @click="openImportDialog">Import</button>
          <button class="secondary" type="button" @click="openExportDialog">Export</button>
        </div>
      </div>
    </section>

    <div id="employees" class="employee-results">
      <section class="table-wrap" aria-label="Employee grid">
        <table>
          <thead>
            <tr>
              <th v-for="column in columns" :key="column.key" scope="col">
                <button class="sort-button" type="button" @click="setSort(column.key)">
                  {{ column.label }}
                  <span v-if="sortKey === column.key">{{ sortDirection === 'asc' ? 'Asc' : 'Desc' }}</span>
                </button>
              </th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="employee in pagedEmployees" :key="employee.code">
              <td>
                <button class="name-button" type="button" @click="openView(employee)">
                  <strong>{{ employee.fullName }}</strong>
                  <span>{{ employee.code }}</span>
                </button>
              </td>
              <td>{{ employee.occupation }}</td>
              <td>{{ employee.department }}</td>
              <td>
                <div class="status-cell">
                  <span :class="['status-pill', statusTone(employmentStatus(employee.dateOfEmployment))]">
                    {{ employmentStatus(employee.dateOfEmployment) }}
                  </span>
                  <small>{{ formatDate(employee.dateOfEmployment) }}</small>
                </div>
              </td>
              <td>
                <div class="status-cell">
                  <span :class="['status-pill', statusTone(terminationStatus(employee.terminationDate))]">
                    {{ terminationStatus(employee.terminationDate) }}
                  </span>
                  <small>{{ formatDate(employee.terminationDate) }}</small>
                </div>
              </td>
              <td>
                <div class="row-actions">
                  <button class="secondary compact" type="button" @click="openView(employee)">View</button>
                  <button class="secondary compact" type="button" @click="openEdit(employee)">Edit</button>
                  <button class="danger compact" type="button" @click="askDelete(employee)">Delete</button>
                </div>
              </td>
            </tr>
            <tr v-if="pagedEmployees.length === 0">
              <td colspan="6" class="empty-state">No employees match the current filters.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="mobile-employee-list" aria-label="Employee mobile list">
        <article v-for="employee in pagedEmployees" :key="employee.code" class="employee-card">
          <header class="employee-card-header">
            <div>
              <button class="name-button" type="button" @click="openView(employee)">
                <strong>{{ employee.fullName }}</strong>
                <span>{{ employee.code }}</span>
              </button>
              <p>{{ employee.occupation }}</p>
            </div>
            <span class="department-chip">{{ employee.department }}</span>
          </header>

          <dl class="employee-card-status">
            <div class="status-panel">
              <dt>Employment</dt>
              <dd>
                <span :class="['status-pill', statusTone(employmentStatus(employee.dateOfEmployment))]">
                  {{ employmentStatus(employee.dateOfEmployment) }}
                </span>
                <small>{{ formatDate(employee.dateOfEmployment) }}</small>
              </dd>
            </div>
            <div class="status-panel">
              <dt>Termination</dt>
              <dd>
                <span :class="['status-pill', statusTone(terminationStatus(employee.terminationDate))]">
                  {{ terminationStatus(employee.terminationDate) }}
                </span>
                <small>{{ formatDate(employee.terminationDate) }}</small>
              </dd>
            </div>
          </dl>

          <div class="mobile-card-actions">
            <button class="secondary compact" type="button" @click="openView(employee)">View</button>
            <button class="secondary compact" type="button" @click="openEdit(employee)">Edit</button>
            <button class="danger compact" type="button" @click="askDelete(employee)">Delete</button>
          </div>
        </article>

        <p v-if="pagedEmployees.length === 0" class="empty-state">
          No employees match the current filters.
        </p>
      </section>
    </div>

    <footer class="pagination" aria-label="Pagination">
      <span>
        Showing {{ sortedEmployees.length === 0 ? 0 : ((page - 1) * pageSize) + 1 }}
        to {{ Math.min(page * pageSize, sortedEmployees.length) }}
        of {{ sortedEmployees.length }}
      </span>
      <label>
        <span>Rows</span>
        <select v-model.number="pageSize" @change="resetPaging">
          <option :value="10">10</option>
          <option :value="20">20</option>
          <option :value="50">50</option>
        </select>
      </label>
      <div>
        <button class="secondary compact" type="button" :disabled="page === 1" @click="page -= 1">
          Previous
        </button>
        <span class="page-count">Page {{ page }} / {{ totalPages }}</span>
        <button class="secondary compact" type="button" :disabled="page === totalPages" @click="page += 1">
          Next
        </button>
      </div>
    </footer>

    <button class="create-button" type="button" @click="openCreate">Create Employee</button>

    <aside v-if="mode !== 'list'" class="drawer" aria-label="Employee profile">
      <div class="drawer-panel">
        <button class="close-button" type="button" aria-label="Close panel" @click="closePanel">x</button>

        <template v-if="mode === 'view' && selectedEmployee">
          <p class="eyebrow">{{ selectedEmployee.code }}</p>
          <h2>{{ selectedEmployee.fullName }}</h2>
          <p class="subtitle">{{ selectedEmployee.occupation }} - {{ selectedEmployee.department }}</p>

          <dl class="profile-list">
            <div>
              <dt>Date of employment</dt>
              <dd>{{ formatDate(selectedEmployee.dateOfEmployment) }}</dd>
            </div>
            <div>
              <dt>Employment status</dt>
              <dd>{{ employmentStatus(selectedEmployee.dateOfEmployment) }}</dd>
            </div>
            <div>
              <dt>Termination date</dt>
              <dd>{{ formatDate(selectedEmployee.terminationDate) }}</dd>
            </div>
            <div>
              <dt>Termination status</dt>
              <dd>{{ terminationStatus(selectedEmployee.terminationDate) }}</dd>
            </div>
          </dl>

          <div class="drawer-actions">
            <button class="primary" type="button" @click="openEdit(selectedEmployee)">Edit profile</button>
            <button class="danger" type="button" @click="askDelete(selectedEmployee)">Delete</button>
          </div>
        </template>

        <template v-else>
          <p class="eyebrow">{{ mode === 'create' ? 'New employee' : 'Edit employee' }}</p>
          <h2>{{ mode === 'create' ? 'Create Employee' : 'Edit Employee' }}</h2>

          <form class="employee-form" novalidate @submit.prevent="saveEmployee">
            <label>
              <span>Code *</span>
              <input v-model="form.code" autocomplete="off" />
              <small v-if="formErrors.code">{{ formErrors.code }}</small>
            </label>

            <label>
              <span>Full name *</span>
              <input v-model="form.fullName" autocomplete="name" />
              <small v-if="formErrors.fullName">{{ formErrors.fullName }}</small>
            </label>

            <label>
              <span>Occupation *</span>
              <input v-model="form.occupation" />
              <small v-if="formErrors.occupation">{{ formErrors.occupation }}</small>
            </label>

            <label>
              <span>Department *</span>
              <input v-model="form.department" list="department-options" />
              <datalist id="department-options">
                <option
                  v-for="department in departments.filter((item) => item !== 'All departments')"
                  :key="department"
                  :value="department"
                />
              </datalist>
              <small v-if="formErrors.department">{{ formErrors.department }}</small>
            </label>

            <label>
              <span>Date of employment</span>
              <input v-model="form.dateOfEmployment" type="date" />
              <small v-if="formErrors.dateOfEmployment">{{ formErrors.dateOfEmployment }}</small>
            </label>

            <label>
              <span>Termination date</span>
              <input v-model="form.terminationDate" type="date" />
              <small v-if="formErrors.terminationDate">{{ formErrors.terminationDate }}</small>
            </label>

            <div class="drawer-actions">
              <button class="primary" type="submit">Save</button>
              <button class="secondary" type="button" @click="closePanel">Cancel</button>
            </div>
          </form>
        </template>
      </div>
    </aside>

    <div v-if="confirmDelete" class="modal-backdrop" role="presentation">
      <section class="modal delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title">
        <div class="delete-header">
          <span class="warning-mark" aria-hidden="true">!</span>
          <div>
            <p class="eyebrow">Confirm removal</p>
            <h2 id="delete-title">Delete employee record?</h2>
          </div>
        </div>

        <p>
          This action removes the employee from the current dashboard list. Review the
          details below before confirming.
        </p>

        <dl class="delete-summary">
          <div>
            <dt>Employee</dt>
            <dd>{{ confirmDelete.fullName }}</dd>
          </div>
          <div>
            <dt>Code</dt>
            <dd>{{ confirmDelete.code }}</dd>
          </div>
          <div>
            <dt>Department</dt>
            <dd>{{ confirmDelete.department }}</dd>
          </div>
        </dl>

        <div class="modal-actions delete-actions">
          <button class="secondary" type="button" @click="confirmDelete = null">Keep employee</button>
          <button class="danger" type="button" @click="deleteEmployee">Delete record</button>
        </div>
      </section>
    </div>

    <div v-if="showImportDialog" class="modal-backdrop" role="presentation">
      <section class="modal import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title">
        <h2 id="import-title">Import employees</h2>
        <p>
          Add employees from a JSON array using the exact fields shown below.
          Unsupported fields, missing fields, invalid dates, and duplicate codes are rejected.
        </p>

        <button
          :class="['import-dropzone', { dragging: isDraggingImport }]"
          type="button"
          @click="importInput?.click()"
          @dragenter.prevent="isDraggingImport = true"
          @dragover.prevent="isDraggingImport = true"
          @dragleave.prevent="isDraggingImport = false"
          @drop.prevent="dropImportFile"
        >
          <strong>Drop JSON file here</strong>
          <span>{{ importFileName || 'Only the employee JSON format is accepted.' }}</span>
        </button>

        <label class="json-input">
          <span>Paste JSON</span>
          <textarea
            v-model="importText"
            spellcheck="false"
            placeholder="Paste employee JSON here..."
          ></textarea>
        </label>

        <details class="import-example">
          <summary>Show required format</summary>
          <pre>{{ importExample }}</pre>
        </details>

        <p v-if="importError" class="inline-error import-error" role="alert">{{ importError }}</p>

        <div class="modal-actions">
          <button class="secondary" type="button" @click="closeImportDialog">Cancel</button>
          <button class="primary" type="button" @click="importEmployees">Add employees</button>
        </div>
      </section>
    </div>

    <div v-if="showExportDialog" class="modal-backdrop" role="presentation">
      <section class="modal export-modal" role="dialog" aria-modal="true" aria-labelledby="export-title">
        <h2 id="export-title">Export employees</h2>
        <p>
          Choose the file format and whether to export every employee or only the
          records matching the current filters.
        </p>

        <fieldset class="option-group">
          <legend>Format</legend>
          <label>
            <input v-model="exportFormat" type="radio" value="json" />
            <span>JSON</span>
          </label>
          <label>
            <input v-model="exportFormat" type="radio" value="csv" />
            <span>Excel sheet (.csv)</span>
          </label>
        </fieldset>

        <fieldset class="option-group">
          <legend>Records</legend>
          <label>
            <input v-model="exportScope" type="radio" value="all" />
            <span>Full list ({{ employees.length }} employees)</span>
          </label>
          <label>
            <input v-model="exportScope" type="radio" value="filtered" />
            <span>Current filtered result ({{ sortedEmployees.length }} employees)</span>
          </label>
        </fieldset>

        <div class="modal-actions">
          <button class="secondary" type="button" @click="closeExportDialog">Cancel</button>
          <button class="primary" type="button" @click="downloadEmployees">Download</button>
        </div>
      </section>
    </div>
  </main>

  <div class="toast-stack" aria-live="polite" aria-label="Notifications">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      :class="['toast', toast.type]"
      role="status"
    >
      <span>{{ toast.message }}</span>
      <button type="button" aria-label="Dismiss notification" @click="removeToast(toast.id)">x</button>
    </div>
  </div>
</template>
