# Teacher Dashboard Feature (Phase 2)

## Overview
The Teacher Dashboard extends the CampusLoom portal framework developed in Phase 1. It provides a secure, role-based environment (`/teacher/*`) for teaching staff to manage their classes, students, study materials, and direct communication.

## Architecture & Code Reuse

Building upon the robust foundation laid during the Student Dashboard rollout, the Teacher Dashboard leverages a shared architecture to prevent code duplication and ensure uniform aesthetics.

### Layout System (`PortalLayout.jsx`)
In Phase 2, we abstracted the core layout mechanics out of `StudentLayout` into a global `PortalLayout.jsx`.
- **Shared Functionality**: Handles the animated sidebar folding, top navigation bar rendering, breadcrumb generation, user profile dropdowns, and responsiveness.
- **Implementation**: Instead of rewriting the sidebar, both `StudentLayout` and the new `TeacherLayout` are just configuration wrappers that pass their respective `SIDEBAR_LINKS` and portal labels down to `PortalLayout`.

### Routing Strategy
- **`routes/teacherRoutes.jsx`**: Manages the exact mapping of all 18+ teacher module paths (e.g., `/teacher/salary`, `/teacher/syllabus`).
- **Role Isolation**: The root `router` in `index.jsx` utilizes `ProtectedRoute` to restrict `/teacher/*` to the `teacher` role and `/account/*` to the `student` role, ensuring zero data leakage or portal crossing.

## Feature Structure (`src/features/teacher/`)
The teacher ecosystem lives cleanly within its own domain:
1. **`pages/TeacherDashboardPage.jsx`**: The entry point providing an overview of assigned classes, tasks, and quick actions.
2. **`pages/ChatWithStudentPage.jsx`**: A specialized mock interface showcasing how teacher-student messaging will look and feel when fully wired up.
3. **Placeholder System**: The remaining modules use the standardized `PlaceholderPage.jsx` (which was relocated to `src/components/common/` to be shared across all roles). This generates a polished "Coming Soon" card for areas pending backend integration.
4. **`api.js`**: Prepares the structure for dedicated teacher-facing API requests.

## Phase 3 Readiness (The Workflow Execution)

The frontend is now structurally complete. Phase 3 will pivot entirely to backend wiring, data fetching, and state management.

### Next Steps for Phase 3:
- **API Wiring**: Fill out `features/teacher/api.js` and `features/student/api.js` with corresponding hooks (e.g., `useGetClasses`, `useMarkAttendance`).
- **Hydrating UI**: Replace the static mock stats on `TeacherDashboardPage` and `StudentDashboardPage` with live data fetched via React Query.
- **Workflow Activation**: Start converting "Placeholder" pages into interactive data tables and forms for modules like "Study Material Upload", "Attendance Marking", and "Test Assignment".
- **Real-Time features**: Implement WebSocket or polling systems to breathe life into the mock `ChatWithStudentPage` and `ChatPage`.
