# Design System

CampusLoom uses **Tailwind CSS v4** with **shadcn/ui** components built on a custom color palette designed for educational SaaS.

## Color System

### Philosophy
The color palette projects **trust, professionalism, and clarity** — essential for a school management platform.

### Semantic Tokens

| Token                  | Light Mode                         | Usage                              |
| ---------------------- | ---------------------------------- | ---------------------------------- |
| `--primary`            | Deep blue (oklch 0.38 0.15 265)    | Buttons, links, active states      |
| `--primary-foreground` | Near-white                         | Text on primary backgrounds        |
| `--secondary`          | Soft blue-gray                     | Secondary actions, subtle surfaces |
| `--accent`             | Warm amber (oklch 0.82 0.15 85)    | Highlights, badges, emphasis       |
| `--muted`              | Light blue-gray                    | Disabled states, helper text       |
| `--destructive`        | Red                                | Delete buttons, error states       |
| `--background`         | Off-white with blue tint           | Page backgrounds                   |
| `--card`               | Pure white                         | Card surfaces                      |
| `--border`             | Subtle blue-gray                   | Borders, dividers                  |

### Dark Mode
All tokens have dark-mode counterparts defined in the `.dark` CSS class. Dark mode can be toggled by adding/removing the `dark` class on the `<html>` element (Phase 2+).

## Typography

| Property      | Value                                    |
| ------------- | ---------------------------------------- |
| Font Family   | `Geist Variable` (via @fontsource)       |
| Heading Font  | Same as body (consistent brand feel)     |
| Base Size     | 14px (Tailwind default)                  |
| Headings      | `tracking-tight` for premium density     |
| Anti-aliasing | `antialiased` for crisp rendering        |

## Spacing & Radius Scale

Spacing follows Tailwind's default 4px grid system. Border radius uses shadcn's token-based scale:

| Token          | Value                          |
| -------------- | ------------------------------ |
| `--radius`     | `0.625rem` (10px)              |
| `--radius-sm`  | `0.375rem` (6px)               |
| `--radius-md`  | `0.5rem` (8px)                 |
| `--radius-lg`  | `0.625rem` (10px)              |
| `--radius-xl`  | `0.875rem` (14px)              |

## Component Library

### Installed shadcn/ui Components

| Component | File                            | Usage                                   |
| --------- | ------------------------------- | --------------------------------------- |
| Button    | `components/ui/button.jsx`      | Primary actions, navigation, forms      |
| Input     | `components/ui/input.jsx`       | Form text inputs                        |
| Card      | `components/ui/card.jsx`        | Content containers, stat cards, forms   |

### Adding New shadcn Components

```bash
npx shadcn@latest add [component-name]
```

Components are installed to `src/components/ui/` and can be customized freely.

### Custom Common Components

| Component       | File                                | Usage                              |
| --------------- | ----------------------------------- | ---------------------------------- |
| Logo            | `components/common/Logo.jsx`        | Brand logo with size variants      |
| Spinner         | `components/common/Spinner.jsx`     | Loading states                     |
| ProtectedRoute  | `components/common/ProtectedRoute.jsx` | Route guard (Phase 2)           |

## CSS Architecture

The design system is defined in `src/index.css` using Tailwind v4's CSS-first approach:

```css
@import "tailwindcss";         /* Core Tailwind */
@import "tw-animate-css";      /* Animation utilities */
@import "shadcn/tailwind.css"; /* shadcn integration */

@theme inline { ... }          /* Token mappings */
:root { ... }                  /* Light theme values */
.dark { ... }                  /* Dark theme values */
@layer base { ... }            /* Base resets */
```

### Why Tailwind v4?

1. **CSS-first config** — no `tailwind.config.js` file needed
2. **Smaller CSS output** — better performance at scale
3. **Faster builds** — optimized JIT engine
4. **Native CSS features** — custom properties, `@layer`, `@theme`

## Design Patterns

### Consistent Page Layout
Every page follows this structure:
```jsx
<div>
  <section className="bg-gradient-to-br from-primary/5 ...">  {/* Header */}
    <h1>Page Title</h1>
    <p>Description</p>
  </section>
  <section className="mx-auto max-w-7xl px-4 py-16 ...">  {/* Content */}
    {/* Page content */}
  </section>
</div>
```

### Responsive Breakpoints
Following Tailwind's mobile-first approach:
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px
