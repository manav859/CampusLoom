# Frontend Conventions

Consistent conventions ensure the CampusLoom codebase remains maintainable and scalable as the team grows.

## File Naming

| Type            | Convention              | Example                    |
| --------------- | ----------------------- | -------------------------- |
| Pages           | `PascalCase + Page`     | `HomePage.jsx`             |
| Components      | `PascalCase`            | `PublicLayout.jsx`         |
| Hooks           | `camelCase + use`       | `useAuth.js`               |
| Utilities       | `camelCase`             | `utils.js`                 |
| Services        | `camelCase`             | `authService.js`           |
| Route configs   | `camelCase + Routes`    | `publicRoutes.jsx`         |
| Constants       | `camelCase`             | `constants.js`             |

## Component Structure

```jsx
// 1. External imports (React, libraries)
import { useState } from 'react';
import { Link } from 'react-router-dom';

// 2. Internal imports (components, hooks, utils)
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// 3. Constants (outside component)
const NAV_LINKS = [...];

// 4. Component (default export)
/**
 * JSDoc description of the component.
 */
export default function ComponentName({ prop1, prop2 }) {
  // State declarations
  // Effect hooks
  // Event handlers
  // Return JSX
}
```

## Import Ordering

1. **React** and React ecosystem (`react`, `react-dom`)
2. **External libraries** (`react-router-dom`, `@tanstack/react-query`, `lucide-react`)
3. **Internal utilities** (`@/lib/utils`, `@/lib/api`)
4. **Internal components** (`@/components/ui/*`, `@/components/common/*`)
5. **Pages** (only in route files)
6. **Styles** (only in `main.jsx`)

Always use the `@/` alias for internal imports — never relative paths like `../../`.

## Code Quality Rules

### DO
- ✅ Keep components under 200 lines
- ✅ Extract constants outside component scope
- ✅ Use named exports for utilities, default exports for components
- ✅ Add JSDoc comments to all exported components and functions
- ✅ Use `cn()` for conditional class merging
- ✅ Use shadcn/ui primitives before building custom UI
- ✅ Prepare for i18n — no inline literal strings that should be translated

### DON'T
- ❌ Add business logic inside page/component files — use hooks and services
- ❌ Hardcode API URLs or environment values
- ❌ Use `dangerouslySetInnerHTML`
- ❌ Create god components (>300 lines)
- ❌ Duplicate UI patterns — extract to `components/common/`
- ❌ Import from node_modules directly when a wrapper exists (use `@/lib/api` not `axios`)
- ❌ Add `console.log` statements in committed code

## Git Practices

- **Branch naming**: `feature/admin-users`, `fix/login-redirect`, `chore/update-deps`
- **Commit messages**: Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`)
- **No `.env` files**: Only `.env.example` is committed

## Responsive Design Rules

1. Design **mobile-first** — base styles are for mobile
2. Use Tailwind breakpoints progressively: `sm:`, `md:`, `lg:`, `xl:`
3. Test all pages at 320px, 768px, 1024px, and 1440px widths
4. Navigation collapses to "hamburger" on `< md` breakpoint

## Data Fetching Pattern

```
Page Component
  └── Custom Hook (useFeatureData)
        └── React Query (useQuery / useMutation)
              └── Service Function (api.get / api.post)
                    └── Axios Instance (src/lib/api.js)
```

This ensures:
- Pages remain thin
- Data logic is testable and reusable
- Network calls are centralized through a single Axios instance
