# CampusLoom Frontend Documentation

Welcome to the CampusLoom frontend documentation. This guide covers architecture, conventions, and onboarding for the React application.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | React 19 + Vite 8 |
| Styling | Tailwind CSS v4 |
| UI Library | shadcn/ui |
| Routing | React Router v7 |
| Server State | TanStack React Query |
| HTTP Client | Axios |
| Charts | Recharts |
| Icons | Lucide React |

## Environment

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `VITE_API_URL` | Yes | `http://localhost:5000/api/v1` | Backend API base URL |

## Documentation Index

| Document | Description |
| --- | --- |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Folder structure and design principles |
| [ROUTING.md](./ROUTING.md) | Route definitions and layout hierarchy |
| [API_LAYER.md](./API_LAYER.md) | Axios setup and React Query patterns |
| [ERROR_HANDLING.md](./ERROR_HANDLING.md) | Sanitised API errors, fallback UI, and defensive rendering rules |
| [AUTH.md](./AUTH.md) | Live authentication flow and session rules |
| [DASHBOARD.md](./DASHBOARD.md) | Live admin dashboard architecture |
| [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | Color system, typography, components |
| [CONVENTIONS.md](./CONVENTIONS.md) | Naming, imports, code quality rules |

## Current Status

| Area | Status | Notes |
| --- | --- | --- |
| Project Setup | Complete | Vite + React + Tailwind + shadcn/ui |
| Routing | Complete | Public, auth, and protected admin trees |
| API Client | Hardened | Sanitised errors, normalized envelopes, safe fallback helpers |
| React Query | Hardened | Shared client config with retries disabled for admin stability |
| Auth | Live | Login, session restore, logout on invalid token |
| Dashboard | Stable | Authenticated stats, charts, activity, safe degraded states |
| Admin Routes | Stable | Protected tree, placeholder routes, router error boundaries |
| Feature Modules | Day 3 | `auth` and `dashboard` active, other modules isolated safely |
