# SmartShala Frontend

Next.js App Router frontend for SmartShala V1.

## Run Locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Default URL: `http://localhost:3000`

## Structure

- `src/app` contains route pages.
- `src/components` contains reusable layout and UI elements.
- `src/features` contains feature-specific client workflows.
- `src/lib/api.ts` is the REST client wrapper.
- `src/types` contains shared frontend types.

The attendance marking page defaults every student to present so teachers only tap exceptions.

