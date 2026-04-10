# Students Frontend

This document describes the Day 7 student management frontend for CampusLoom.

## Architecture

Location: `frontend/src/features/students/`

```
features/students/
├── api.js                        # Query keys + API functions
├── hooks/
│   └── useAdminStudents.js       # React Query hook for admin listing
└── components/
    └── StudentsTable.jsx         # Student roster table
```

Page: `pages/admin/StudentsPage.jsx`
Route: `/admin/students`

## Feature Structure

### api.js

- `studentsQueryKeys` — structured query key factory
- `getAdminStudents()` — fetches all students with strict error handling
- `getAdminStudentById(id)` — fetches a single student
- `deleteAdminStudent(id)` — deletes a student

### Hooks

- `useAdminStudents()` — React Query wrapper, enabled only when authenticated

### Components

- `StudentsTable` — renders the student roster in a table with:
  - Name and short ID
  - Class badge
  - Contact info (email + phone)
  - Enrollment date
  - Action buttons: view results (navigates to `/admin/results?student=id`), delete

### Page

The `StudentsPage` displays:

1. **Header** — module label, title, and description
2. **Stat cards** — total students count and unique class count
3. **Student table** — the full roster with delete capability
4. **States** — loading spinner, error with retry, empty state with guidance

## UI Patterns

- Follows the same page structure as `AdmissionsPage`
- Uses raw HTML `<table>` elements matching the existing `AdmissionsTable` pattern
- Delete uses `window.confirm()` before executing
- Error feedback displayed as inline alert above the table

## Sidebar Integration

Added to `AdminLayout.jsx` sidebar:
- **Students** — `UserCheck` icon, path `/admin/students`
- Placed after Admissions in the navigation flow

## Route Registration

Added to `adminRoutes.jsx`:
- `{ path: 'students', element: <StudentsPage /> }`
