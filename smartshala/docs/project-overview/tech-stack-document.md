# Tech Stack Document

#### Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | ^15.0.3 | React framework (App Router) |
| React | ^19.0.0 | UI library |
| React DOM | ^19.0.0 | DOM rendering |
| Tailwind CSS | ^3.4.15 | Utility-first CSS |
| Framer Motion | ^12.38.0 | Animations & transitions |
| Recharts | ^3.8.1 | Charts & data visualization |
| TypeScript | ^5.6.3 | Type safety |
| PostCSS | ^8.4.49 | CSS processing |
| Autoprefixer | ^10.4.20 | CSS vendor prefixes |
| ESLint | ^9.15.0 | Linting |

#### Backend

| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | 20+ (required) | Runtime |
| Express.js | ^4.21.1 | HTTP framework |
| Prisma | ^5.22.0 | ORM & migrations |
| TypeScript | ^5.6.3 | Type safety |
| Zod | ^3.23.8 | Request validation |
| bcryptjs | ^2.4.3 | Password hashing |
| jsonwebtoken | ^9.0.2 | JWT auth tokens |
| Helmet | ^8.0.0 | Security headers |
| CORS | ^2.8.5 | Cross-origin support |
| Morgan | ^1.10.1 | HTTP request logging |
| Pino / Pino HTTP | ^9.4.0 / ^10.3.0 | Structured logging |
| Multer | ^2.1.1 | File uploads |
| PDFKit | ^0.18.0 | PDF receipt generation |
| tsx | ^4.19.2 | TypeScript execution (dev) |

#### Database & Infrastructure

| Technology | Purpose |
|-----------|---------|
| PostgreSQL 14+ | Primary database |
| Neon PostgreSQL (Cloud) | Managed serverless PostgreSQL |
| Neon API | Dynamic tenant database creation/deletion |
| Redis (placeholder) | Queue-ready for notification jobs |

#### Design System

| Token | Value |
|-------|-------|
| Primary font | Inter (sans-serif) |
| Hindi/Devanagari font | Hind / Mukta / Tiro Devanagari Hindi |
| Code font | Monospace (receipt IDs, admission numbers) |
| UI style | Apple-inspired glassmorphism with frosted panels |
| Color palette | Apple palette (blue #0071e3, green #34c759, orange #ff9500, red #ff3b30) |
