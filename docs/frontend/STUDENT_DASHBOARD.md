# Student Dashboard Feature

## Overview
The Student Dashboard replaces the static account page with a modular, scalable portal designed for students to track their academic progress, communicate, and stay updated. The architectural foundation built here is also the precursor to Phase 2: Teacher Dashboard.

## Architecture & Reusability
The dashboard is contained largely within the `src/features/student/` module. 
We migrated the old unstructured `/account` logic into organized files and directories based on distinct functional boundaries.

### Routing System
All related routes are securely nested under `/account/*`.
- **`routes/studentRoutes.jsx`**: A dedicated file exporting an array of Route objects for all dashboard segments.
- **`routes/index.jsx`**: The `StudentLayout` encompasses these routes and implements an overarching `ProtectedRoute` restricted to `student` accounts (and temporarily `teacher` until their dedicated dashboard is ready in Phase 2).

### Layout System (`StudentLayout.jsx`)
The `StudentLayout` provides:
1.  **SidebarNavigation**: A responsive left-sidebar using `framer-motion` to smoothly collapse/expand, identical to Admin but distinct in its linking structures.
2.  **Top Navigation**: Replaces typical page headers. Dynamic breadcrumbs update based on the current child route.
3.  **Content Area**: Features the `Outlet` for child routes rendering on a `muted/20` background.

**Phase 2 Readiness**:
The `StudentLayout` has been built as a clean shell. In Phase 2, this layout can either:
- Be renamed to `PortalLayout` and dynamically load `SIDEBAR_LINKS` via a prop.
- Be cleanly duplicated and tailored as `TeacherLayout` since the design foundation is already solved.

## Feature Structure
Directory: `src/features/student/`
- `api.js`: Exposes upcoming API calls for student-centric data (attendance, chat).
- `hooks/`: Placeholder layer for React Query queries built on top of `api.js`.
- `components/`: Contains UI items like `PlaceholderPage.jsx` which enforces a uniform design syntax for all uncompleted modules during Phase 1.
- `pages/`: Dedicated layout views for every sidebar item (e.g., `ChatPage`, `StudentDashboardPage`).

## Key Decisions
- **`StudentDashboardPage.jsx`**: Migrated `AccountPage` code to this file, preserving "My Results" and "Linked Admissions" lists but presenting them within the new aesthetic container.
- **Mock UI for ChatPage**: We established a basic mock format for `ChatPage` to visually anchor how student-teacher communication will feel.
- **Placeholder UI**: Used a generic generic `PlaceholderPage` Component. It drastically reduces boilerplate for the 15+ sub-modules and guarantees a polished look.

## Phase 2 Extension Guidelines
When extending this to Teacher Dashboard:
1. Establish `src/features/teacher/` with a similar sub-folder layout.
2. Ensure you create a `routes/teacherRoutes.jsx`.
3. If abstracting the Layout, extract `SidebarContent` from `StudentLayout.jsx` into `components/layouts/SidebarContent.jsx` and pass the link array as a parameter.
