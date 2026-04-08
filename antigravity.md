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
- [ ] Initial Database Schema layout.

