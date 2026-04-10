# Results Frontend

This document describes the Day 7 results management frontend for CampusLoom.

## Architecture

Location: `frontend/src/features/results/`

```
features/results/
├── api.js                              # Query keys + API functions
├── hooks/
│   ├── useStudentResults.js            # Admin: fetch results for a student
│   ├── useCurrentUserResults.js        # User: fetch own results
│   └── useCreateResult.js             # Admin: mutation for adding a result
└── components/
    ├── ResultEntryForm.jsx             # Admin form for adding results
    └── ResultsTable.jsx               # Shared results display table
```

Pages:
- `pages/admin/ResultsPage.jsx` — admin results management
- `pages/public/AccountPage.jsx` — user results section (updated)

Routes:
- `/admin/results` — admin page
- `/account` — user page (existing, updated with results)

## Feature Structure

### api.js

- `examTypeOptions` — label/value pairs for exam type dropdowns
- `resultsQueryKeys` — structured query key factory
- `createResult(payload)` — POST to create a result
- `getStudentResults(studentId)` — GET results for a specific student
- `getCurrentUserResults()` — GET logged-in user's own results

### Hooks

- `useStudentResults(studentId)` — enabled when authenticated and studentId is truthy
- `useCurrentUserResults()` — enabled for student/teacher roles only
- `useCreateResult()` — mutation with automatic cache invalidation on success

### Components

- `ResultEntryForm` — admin form with:
  - Student dropdown selector (populated from students list)
  - Subject text input
  - Marks and max marks number inputs
  - Exam type dropdown
  - Success/error feedback messages
  - Form reset on successful submission

- `ResultsTable` — shared table showing:
  - Subject
  - Marks obtained
  - Maximum marks
  - Calculated percentage with color coding (green ≥ 40%, red < 40%)
  - Exam type badge

## Admin Page (`ResultsPage`)

Two sections:

1. **Add Result** — the `ResultEntryForm` component
2. **View Results** — student selector dropdown + `ResultsTable`
   - Supports URL param `?student=<id>` for deep-linking from students page
   - Full loading/error/empty states per section

## User Account Integration (`AccountPage`)

Added a **"My Results"** section between the profile header and admissions list:

- Only renders for `student` and `teacher` roles
- Uses `useCurrentUserResults()` hook
- Displays `ResultsTable` with the user's own results
- Full loading/error/empty states
- Clear messaging that only the user's own data is shown

## UI Patterns

- Tables use raw HTML `<table>` elements matching existing patterns
- Form inputs use shadcn `Input` and native `<select>` elements
- Error/success messages use inline alert boxes with colored borders
- All async states handled: loading, error with retry, empty with guidance

## Sidebar Integration

Added to `AdminLayout.jsx` sidebar:
- **Results** — `ClipboardList` icon, path `/admin/results`
- Placed after Students in the navigation flow

## Route Registration

Added to `adminRoutes.jsx`:
- `{ path: 'results', element: <ResultsPage /> }`

## Data Flow

```
Admission → Approved → Student auto-created
                            ↓
                    Admin adds results (POST /results)
                            ↓
                    Student views results (GET /user/results)
```
