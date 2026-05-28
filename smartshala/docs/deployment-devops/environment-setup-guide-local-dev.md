# Environment Setup Guide (Local Dev)

```bash
# Prerequisites: Node.js 20+, PostgreSQL 14+ (or Neon account), npm

# 1. Clone the repository
git clone https://github.com/manav859/CampusLoom.git
cd CampusLoom/smartshala

# 2. Backend setup
cd backend
npm install
cp .env.example .env
# Edit .env with your PostgreSQL/Neon credentials and JWT secrets

# Generate Prisma clients
npm run prisma:generate:all

# Run migrations
npm run prisma:migrate -- --name init

# Seed demo data
npm run seed

# Start backend (dev mode with hot reload)
npm run dev
# → http://localhost:4000/api/v1

# 3. Frontend setup (in a new terminal)
cd ../frontend
npm install
cp .env.example .env.local
# Edit .env.local if backend is not on localhost:4000

# Start frontend
npm run dev
# → http://localhost:3000

# 4. Login with demo credentials
#    Email: principal@smartshala.local
#    Password: SmartShala@123
```
