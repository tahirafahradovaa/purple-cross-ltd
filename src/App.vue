<script setup>
import { computed, reactive, ref } from 'vue';
import employeesSeed from '../purple_cross_employees.json';
import {
  createEmptyEmployee,
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
const appVersion = '1.0.0';
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

  if (loginError.value) return;

  currentUser.value = createSessionUser(loginForm.email);
  writeStoredSession(window.localStorage, currentUser.value);
  isAuthenticated.value = true;
}

function logout() {
  // Clear transient UI state so the next session starts from the dashboard list.
  closePanel();
  confirmDelete.value = null;
  clearStoredSession(window.localStorage);
  isAuthenticated.value = false;
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

  if (Object.keys(errors).length > 0) return;

  const normalized = normalizeEmployee(form);

  if (mode.value === 'edit') {
    // Replace by the original immutable key in case the employee code was edited.
    employees.value = employees.value.map((employee) => (
      employee.code === originalCode.value ? normalized : employee
    ));
    selectedEmployee.value = normalized;
  } else {
    employees.value = [...employees.value, normalized];
    selectedEmployee.value = normalized;
  }

  mode.value = 'view';
  resetPaging();
}

function askDelete(employee) {
  confirmDelete.value = employee;
}

function deleteEmployee() {
  if (!confirmDelete.value) return;

  employees.value = employees.value.filter((employee) => employee.code !== confirmDelete.value.code);
  if (selectedEmployee.value?.code === confirmDelete.value.code) closePanel();
  confirmDelete.value = null;
  resetPaging();
}

function downloadEmployees() {
  const blob = new Blob([exportJson(employees.value)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'purple_cross_employees_export.json';
  anchor.click();
  URL.revokeObjectURL(url);
}

function openImportPicker() {
  importError.value = '';
  importInput.value?.click();
}

async function importEmployees(event) {
  const [file] = event.target.files || [];
  if (!file) return;

  try {
    const text = await file.text();
    const imported = parseImportedEmployees(text);

    // Imports go through the same rules as manual entry to keep both paths consistent.
    const validationErrors = imported
      .map((employee) => validateEmployee(employee, imported, employee.code))
      .filter((errors) => Object.keys(errors).length > 0);

    if (validationErrors.length) {
      throw new Error('Imported employees contain invalid dates or required fields.');
    }

    employees.value = imported;
    closePanel();
    resetPaging();
  } catch (error) {
    importError.value = error.message || 'Could not import employees.';
  } finally {
    event.target.value = '';
  }
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

    <section class="metrics" aria-label="Employee summary">
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

      <label>
        <span>Department</span>
        <select v-model="departmentFilter" @change="resetPaging">
          <option v-for="department in departments" :key="department" :value="department">
            {{ department }}
          </option>
        </select>
      </label>

      <label>
        <span>Status</span>
        <select v-model="statusFilter" @change="resetPaging">
          <option v-for="status in statuses" :key="status" :value="status">
            {{ status }}
          </option>
        </select>
      </label>

      <div class="toolbar-actions">
        <span>Data</span>
        <input
          ref="importInput"
          class="visually-hidden"
          type="file"
          accept="application/json"
          @change="importEmployees"
        />
        <div class="toolbar-button-row">
          <button class="secondary" type="button" @click="openImportPicker">Import</button>
          <button class="secondary" type="button" @click="downloadEmployees">Export</button>
        </div>
      </div>
    </section>

    <p v-if="importError" class="inline-error">{{ importError }}</p>

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
          <button class="name-button" type="button" @click="openView(employee)">
            <strong>{{ employee.fullName }}</strong>
            <span>{{ employee.code }}</span>
          </button>
          <span>{{ employee.department }}</span>
        </header>

        <dl class="employee-card-details">
          <div>
            <dt>Occupation</dt>
            <dd>{{ employee.occupation }}</dd>
          </div>
          <div>
            <dt>Employment</dt>
            <dd>
              <span :class="['status-pill', statusTone(employmentStatus(employee.dateOfEmployment))]">
                {{ employmentStatus(employee.dateOfEmployment) }}
              </span>
              <small>{{ formatDate(employee.dateOfEmployment) }}</small>
            </dd>
          </div>
          <div>
            <dt>Termination</dt>
            <dd>
              <span :class="['status-pill', statusTone(terminationStatus(employee.terminationDate))]">
                {{ terminationStatus(employee.terminationDate) }}
              </span>
              <small>{{ formatDate(employee.terminationDate) }}</small>
            </dd>
          </div>
        </dl>

        <div class="row-actions">
          <button class="secondary compact" type="button" @click="openView(employee)">View</button>
          <button class="secondary compact" type="button" @click="openEdit(employee)">Edit</button>
          <button class="danger compact" type="button" @click="askDelete(employee)">Delete</button>
        </div>
      </article>

      <p v-if="pagedEmployees.length === 0" class="empty-state">
        No employees match the current filters.
      </p>
    </section>

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

  </main>
</template>
