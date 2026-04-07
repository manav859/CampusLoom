# CampusLoom Frontend Documentation

Welcome to the **CampusLoom Frontend** documentation. This guide covers the architecture, conventions, and developer onboarding for the React-based frontend application.

## Tech Stack

| Layer             | Technology                          |
| ----------------- | ----------------------------------- |
| **Framework**     | React 19 + Vite 8                   |
| **Styling**       | Tailwind CSS v4 (CSS-first config)  |
| **UI Library**    | shadcn/ui (default style)           |
| **Routing**       | React Router v7                     |
| **Server State**  | TanStack React Query                |
| **HTTP Client**   | Axios                               |
| **Icons**         | Lucide React                        |
| **Fonts**         | Geist Variable (via @fontsource)    |

## Quick Start

```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start the development server
npm run dev
```

The app will be available at `http://localhost:5173`.

## Documentation Index

| Document                              | Description                              |
| ------------------------------------- | ---------------------------------------- |
| [ARCHITECTURE.md](./ARCHITECTURE.md)  | Folder structure and design principles   |
| [ROUTING.md](./ROUTING.md)            | Route definitions and layout hierarchy   |
| [API_LAYER.md](./API_LAYER.md)        | Axios setup and React Query patterns     |
| [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)| Color system, typography, components     |
| [CONVENTIONS.md](./CONVENTIONS.md)    | Naming, imports, code quality rules      |

## Environment Variables

| Variable        | Required | Default                             | Description          |
| --------------- | -------- | ----------------------------------- | -------------------- |
| `VITE_API_URL`  | Yes      | `http://localhost:5000/api/v1`      | Backend API base URL |

## Current Status

| Area              | Status           | Notes                                    |
| ----------------- | ---------------- | ---------------------------------------- |
| Project Setup     | ✅ Complete       | Vite + React + Tailwind v4 + shadcn      |
| Folder Structure  | ✅ Complete       | Scalable modular architecture            |
| Routing           | ✅ Complete       | Public + Admin + Auth layouts            |
| Layouts           | ✅ Complete       | PublicLayout, AdminLayout, AuthLayout    |
| API Client        | ✅ Complete       | Axios with interceptors                  |
| React Query       | ✅ Complete       | QueryClient with defaults                |
| Design System     | ✅ Complete       | Color tokens + Button, Input, Card       |
| Auth (RBAC)       | ⏳ Phase 2        | ProtectedRoute shell ready               |
| Feature Modules   | ⏳ Future phases  | Features directory scaffolded            |
