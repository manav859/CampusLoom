# Server & Hosting Configuration Details

| Component | Platform | Details |
|-----------|----------|---------|
| **Backend** | Render.com | Web Service, Node.js |
| **Frontend** | ⚠️ *Not explicitly documented* — likely Render or Vercel | Next.js SSR/SSG |
| **Database** | Neon PostgreSQL | Serverless, us-east-1, pooled + direct endpoints |
| **File Storage** | Local filesystem (`uploads/`) | ⚠️ Ephemeral on Render — needs S3/GCS |
| **DNS** | ⚠️ *Not documented* | — |
| **SSL** | Managed by hosting platform | — |
