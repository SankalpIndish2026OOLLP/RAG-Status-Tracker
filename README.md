# ⬡ RAG Project Tracker

A web-based RAG (Red / Amber / Green) project health tracking tool for Eastern Enterprise.
Replaces the manual Excel workflow with role-based access, automated email reminders, and **6 months of searchable history**.

---

## Architecture

```
rag-tracker/
├── backend/              Express + Node.js REST API
│   ├── src/
│   │   ├── config/db.js          MongoDB connection
│   │   ├── middleware/auth.js     JWT + role guards
│   │   ├── models/
│   │   │   ├── User.js            Users (admin / pm / exec)
│   │   │   ├── Project.js         Projects
│   │   │   └── WeeklyReport.js    Weekly RAG entries (TTL 6 months)
│   │   ├── routes/
│   │   │   ├── auth.js            POST /login, GET /me
│   │   │   ├── users.js           CRUD /users (admin)
│   │   │   ├── projects.js        CRUD /projects
│   │   │   ├── reports.js         Weekly report submit + history
│   │   │   └── email.js           Dashboard + reminder sends
│   │   └── utils/
│   │       ├── weekUtils.js       ISO week helpers
│   │       ├── mailer.js          Nodemailer templates
│   │       ├── cron.js            Scheduled jobs
│   │       └── seed.js            Sample data seeder
│   └── Dockerfile
├── frontend/             React 18 + Vite SPA
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── DashboardPage.jsx       PM + Exec current week
│   │   │   ├── HistoryPage.jsx         6-month heatmap + timeline
│   │   │   ├── PMUpdatePage.jsx        Weekly status form
│   │   │   ├── ExecDetailPage.jsx      Project drill-down
│   │   │   ├── AdminProjectsPage.jsx   Project management
│   │   │   ├── AdminUsersPage.jsx      User management
│   │   │   └── AdminCommsPage.jsx      Email + cron
│   │   ├── components/UI.jsx           Shared components
│   │   ├── hooks/
│   │   │   ├── useAuth.jsx             Auth context
│   │   │   └── useToast.jsx            Toast notifications
│   │   ├── utils/api.js               All API calls
│   │   └── styles/global.css
│   └── Dockerfile
├── docker-compose.yml
├── nginx.conf
└── README.md
```

---

## Roles

| Role      | Can do |
|-----------|--------|
| **Admin** | Add/edit/close projects, manage all users (PM/Exec/Admin), send emails |
| **PM**    | View & update own projects, see own 6-month history |
| **Exec**  | Read-only dashboard, portfolio heatmap, 6-month history, project drill-down |

---

## Quick Start (Local Development)

### Prerequisites
- Node.js 20+
- MongoDB running locally on port 27017  
  *(or update `MONGO_URI` in `.env`)*

### 1. Install dependencies
```bash
cd rag-tracker
cp backend/.env.example backend/.env
# Edit backend/.env with your settings

npm install
npm install --workspace=backend
npm install --workspace=frontend
```

### 2. Seed sample data
```bash
npm run seed
```
This creates 6 months of sample reports for 10 projects and all demo users.

### 3. Run dev servers
```bash
npm run dev
# Backend  → http://localhost:4000
# Frontend → http://localhost:5173
```

### Demo credentials
| Role     | Email             | Password  |
|----------|-------------------|-----------|
| Admin    | admin@ee.com      | admin123  |
| PM       | jasmine@ee.com    | pm123     |
| PM       | hina@ee.com       | pm123     |
| Exec     | exec@ee.com       | exec123   |

---

## Docker Deployment

### 1. Set environment variables
```bash
cp backend/.env.example .env
# Edit .env — set JWT_SECRET, SMTP_*, FRONTEND_URL
```

### 2. Build and start
```bash
docker-compose up -d --build
```

### 3. Seed data (first run)
```bash
docker-compose exec backend node src/utils/seed.js
```

App available at `http://localhost` (port 80).

---

## API Reference

### Auth
| Method | Endpoint        | Description        |
|--------|-----------------|--------------------|
| POST   | /api/auth/login | Login, returns JWT |
| GET    | /api/auth/me    | Get current user   |

### Reports
| Method | Endpoint                       | Access      | Description                         |
|--------|--------------------------------|-------------|-------------------------------------|
| GET    | /api/reports/current-week      | PM / Exec   | This week's reports                 |
| GET    | /api/reports/history/:projectId | PM / Exec  | 6-month history for one project     |
| GET    | /api/reports?months=6          | PM / Exec   | Range query (up to 6 months)        |
| POST   | /api/reports                   | PM only     | Submit/update weekly report (upsert)|

### Query params for GET /api/reports
| Param      | Example       | Description                  |
|------------|---------------|------------------------------|
| projectId  | `?projectId=` | Filter by project            |
| weekKey    | `?weekKey=2026-06` | Specific ISO week       |
| months     | `?months=3`   | Last N months (max 6)        |
| summary    | `?summary=true` | Lean response (no arrays)  |

---

## Data Retention

Weekly reports are **automatically deleted after 6 months** via a MongoDB TTL index on the `weekStartDate` field.

To change the retention window:
```env
# backend/.env
DATA_RETENTION_MONTHS=6
```
⚠️ Changing this requires re-creating the TTL index. Run:
```bash
mongosh rag_tracker --eval "db.weeklyreports.dropIndex('weekStartDate_1'); db.weeklyreports.createIndex({weekStartDate:1},{expireAfterSeconds: N*30*24*3600})"
```

---

## Scheduled Jobs (cron.js)

| Schedule         | Action                                   |
|------------------|------------------------------------------|
| Friday 9:00 AM   | Send reminder emails to PMs with pending updates |
| Friday 5:00 PM   | Send RAG dashboard to all executives     |

Timezone is set to `Europe/Amsterdam` in `backend/src/utils/cron.js` — change as needed.

---

## Adding Email (SMTP)

The app uses Nodemailer. Any SMTP provider works:

**SendGrid:**
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.your_api_key
```

**Gmail (dev/testing only):**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=your_app_password
```

---

## Key Developer Notes

- **One report per project per week** — the `POST /api/reports` endpoint is an **upsert**. Submitting again for the same week updates the existing record.
- **prevRag** is calculated automatically from the previous week's report.
- **Frontend build** outputs to `backend/public/` and is served by Express in production (or Nginx in Docker).
- All dates use **ISO 8601 week numbering** (weeks start Monday). The `weekUtils.js` helper is the single source of truth for week key generation — use it everywhere.
