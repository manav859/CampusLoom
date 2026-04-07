# Environment Configuration

This document specifies the required environment variables the backend relies upon derived from `src/config/env.js`.

**CRITICAL RULE**: The application uses Zod to validate these keys at boot. If you miss a key, or provide a malformed type, the instance halts immediately.

## Variables

| Key                 | Required | Type     | Purpose                                                       | Example/Placeholder                                 |
| ------------------- | -------- | -------- | ------------------------------------------------------------- | --------------------------------------------------- |
| `PORT`              | `No`     | Number   | Port exposed for the API (defaults to 5000)                   | `5000`                                              |
| `NODE_ENV`          | `No`     | Enum     | Running context (`development`, `production`, `test`)         | `development`                                       |
| `DATABASE_URL`      | **Yes**  | String   | MongoDB connection string parsed by Mongoose                  | `mongodb://localhost:27017/campusloom`                |
| `JWT_SECRET`        | **Yes**  | String   | Encryption seed for active Session/Auth tokens                | `dev_secret_change_me_in_production_...`            |
| `CORS_ORIGIN`       | **Yes**  | String   | Strict definition of frontend domains communicating with API  | `http://localhost:5173`                             |

## Secret Management
- **Local (`.env`)**: DO NOT commit your raw `.env` file to source control. It is already included in `.gitignore`.
- **Templates (`.env.example`)**: If you add new required properties into Zod config, please append a safe dummy equivalent into the `.env.example`.
- **Production (Vercel/Render)**: Input secure variables strictly within your infrastructure dashboard; never bundle secrets physically within Docker/build scripts.
