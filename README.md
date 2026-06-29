# Purple Cross Ltd Employee Management

Vue 3 employee management dashboard for the Purple Cross Ltd case study.

## Live Demo

https://purple-cross-ltd.vercel.app/

## Features

- Login screen with client-side validation
- Employee table with sorting, filtering, pagination, and status chips
- Create, view, edit, and delete employee records
- Delete confirmation dialog with employee context
- Employee form validation for required fields, duplicate codes, invalid dates, and termination date rules
- JSON import and export for employee data
- Responsive layout for desktop and smaller screens

## Demo Login

```text
Email: admin@purplecross.test
Password: purplecross
```

## Tech Stack

- Vue 3
- Vite
- Node test runner
- Plain CSS

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:5173/
```

## Scripts

Run tests:

```bash
npm test
```

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Project Structure

```text
src/
  App.vue               Main dashboard, login, modals, and employee flows
  main.js               Vue app entry point
  styles.css            Application styles
  utils/
    auth.js             Login validation helpers
    employees.js        Employee validation, filtering, sorting, and import/export helpers
test/
  auth.test.js          Login validation tests
  employees.test.js     Employee validation and table helper tests
```

## Version

Current version: `1.0.1`
