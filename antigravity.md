# Antigravity Context: CampusLoom


> **AI INSTRUCTION**: Every time a new chat or session with this workspace begins, read this file to gain context on the repository state, goals, and architectural standards.
> **AI INSTRUCTION**: Whenever major milestones are reached, new modules are implemented, or architecture rules are decided, YOU MUST update this file to reflect the latest state.

## Project Description
You are working on a large production-grade SaaS project called **CampusLoom**, a school website and management platform. Treat this as a long-term scalable codebase.

## Technology Stack
- **Frontend**: React, Vite, Tailwind CSS, shadcn/ui, React Query
- **Backend**: Node.js, Fastify, Mongoose, Zod
- **Database**: MongoDB
- **Infra/Storage**: Vercel (frontend), Render (backend), Cloudinary (storage).

## Core Architecture & Rules
1. **Best Practices Only**: Build with scalability. Clean separation of concerns, reusable abstractions, production-ready folder structures.
2. **Multi-Tenancy**: The application supports multiple schools. All data schemas and endpoints must be designed around this concept (e.g., `schoolId` based row-level multi-tenancy). 
3. **Security First**: Validate all inputs (Zod), hash passwords, enforce Role-Based Access Control (RBAC), and use secure authentication (JWT in HttpOnly cookies ideally). No secrets in code.
4. **Extensibility**: Structure data models keeping future modules in mind: parent/student portals, attendance, fees, timetable, notifications.
5. **No Degradation**: Do not downgrade architecture quality or take fast hacks unless explicitly instructed by the user.

## Current State / Milestones
- [x] Initial Phase 1 Implementation Plan created.
- [x] Backend initialization (Fastify + Prisma 6 + Zod + Modular Architecture).
- [x] Backend documentation scaffolded (see `docs/backend/FRONTEND_HANDOFF.md`).
- [x] Frontend initialization (Vite + React + Tailwind v4 + shadcn/ui).
- [x] Frontend architectural foundation (Routing, Layouts, API Client, Documentation).
- [x] Frontend auth integration with backend (`/auth/login`, `/auth/me`, session restore, protected admin tree).
- [x] Feature-based frontend slices for `auth` and `dashboard`.
- [x] Live admin dashboard with React Query, Recharts, loading/error states, and authenticated data fetching.
- [x] Backend auth + RBAC foundation (`authenticate`, `authorizeRoles`, register/login/me flows).
- [x] Backend dashboard stats endpoint (`GET /api/v1/dashboard/stats`) with admin authorization.
- [x] Standard API response helpers adopted for auth and dashboard flows.
- [x] Frontend admin stability hardening: sanitized API errors, route error boundaries, placeholder admin routes, and defensive dashboard fallbacks.
- [x] Full notices / announcements module shipped with backend CRUD APIs, public visibility rules, admin management UI, and public notices page.
- [x] Full admissions module shipped with public inquiry intake, protected admin queue/detail flows, status tracking, internal notes, validation, and documentation.
- [x] Multi-role shared authentication shipped for `admin`, `student`, and `teacher` accounts, including public student/teacher registration, shared login, role-aware routing, and account session restore.
- [x] User account dashboard shipped with linked admissions history and conditional public navigation.
- [x] Admission inquiries can now be attached to authenticated student/teacher accounts and queried through a protected user-scoped endpoint.
- [x] Full student management module shipped with Mongoose model, admin CRUD APIs, automatic admission→student conversion (idempotent), and admin management UI.
- [x] Full results module shipped with Mongoose model, admin result entry APIs, user-scoped result access, and both admin and student-facing UIs.
- [x] Admission→Student auto-conversion on approval with idempotent safety (re-approving is a no-op).
- [x] User account dashboard updated with "My Results" section for student/teacher roles.
- [x] Core ERP loop completed: Inquiry → Admission → Student → Results.
- [ ] Formal multi-tenant `schoolId` enforcement across persisted modules.
- [ ] Initial Database Schema layout.

