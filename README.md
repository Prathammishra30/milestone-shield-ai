# 🛡️ MilestoneShield AI

**Proof before payout.**

MilestoneShield AI is an AI-assisted milestone payment platform that helps freelancers and clients agree on measurable milestones, verify written deliverables against acceptance criteria, and coordinate milestone payments through PayPal Sandbox.

> **⚠️ Prototype Notice:** This is an AI-assisted milestone payment prototype built for the **PayPal AI Hackathon 2026**. It is not a legally regulated escrow service. No real payments are processed during development — all PayPal integration uses Sandbox mode.

---

## ✨ Features

### Implemented (Milestone 1)
- 📊 **Dashboard** — Overview with project stats, active milestones, and pending reviews
- 📁 **Projects View** — Project cards with budget utilization and milestone progress
- 🎯 **Milestones Table** — AG Grid data table with acceptance criteria detail
- 📝 **Submissions View** — Deliverable submissions with review status tracking
- 💰 **Payment Ledger** — Transaction history with sample data and clear disclaimers
- 🏥 **Health API** — `GET /api/health` with uptime, version, and environment info
- ✅ **Request Validation** — Zod-based body and query parameter validation middleware
- 🚨 **Error Handling** — Centralized error handler with structured error responses
- 🧪 **Automated Tests** — Vitest + Supertest test suite for API and validation logic

### Planned (Future Milestones)
- 🤖 **AI Milestone Generation** — Claude-powered acceptance criteria generation
- 🔍 **AI Submission Verification** — Automated deliverable verification against criteria
- 💳 **PayPal Sandbox Integration** — Authorize, capture, and refund milestone payments
- 🗄️ **PostgreSQL Database** — Persistent storage with migrations
- 🔐 **Authentication** — JWT-based auth with role-based access control
- 📋 **Audit Trail** — Immutable log of all payment state transitions

---

## 🏗️ Architecture

```
milestone-shield-ai/
├── frontend/                # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Route page components
│   │   ├── data/            # Sample data (clearly labelled)
│   │   ├── types/           # TypeScript type definitions
│   │   └── index.css        # Tailwind CSS design system
│   └── index.html
├── backend/                 # Express + TypeScript
│   ├── src/
│   │   ├── config/          # Environment configuration (Zod)
│   │   ├── middleware/      # Error handling, validation
│   │   ├── routes/          # API route handlers
│   │   ├── app.ts           # Express app factory
│   │   └── index.ts         # Server entry point
│   └── vitest.config.ts
├── docs/
│   └── api-contract.md      # Full API specification
├── .env.example             # Environment variable template
├── .gitignore
├── package.json             # Monorepo scripts
├── LICENSE                  # MIT
└── README.md
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS v4 |
| Data Grid | AG Grid Community |
| Icons | Lucide React |
| Routing | React Router v7 |
| Backend | Node.js, Express |
| Validation | Zod |
| Testing | Vitest, Supertest |
| AI (planned) | Anthropic Claude API |
| Payments (planned) | PayPal REST API (Sandbox) |
| Database (planned) | PostgreSQL |
| Deployment | Render |

---

## 🚀 Local Setup

### Prerequisites
- Node.js ≥ 20
- npm ≥ 10

### 1. Clone the repository

```bash
git clone https://github.com/Prathammishra30/milestone-shield-ai.git
cd milestone-shield-ai
```

### 2. Install dependencies

```bash
# Install all dependencies (frontend + backend)
npm run install:all

# Or install individually:
cd backend && npm install
cd ../frontend && npm install
```

### 3. Configure environment

```bash
# Copy the example env file
cp .env.example backend/.env

# Edit backend/.env with your values (optional for Milestone 1)
```

### 4. Start development servers

```bash
# Terminal 1 — Backend (http://localhost:3001)
npm run dev:backend

# Terminal 2 — Frontend (http://localhost:5173)
npm run dev:frontend
```

---

## 📋 Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Backend server port | No | `3001` |
| `NODE_ENV` | Environment mode | No | `development` |
| `CORS_ORIGIN` | Allowed CORS origin | No | `http://localhost:5173` |
| `PAYPAL_CLIENT_ID` | PayPal Sandbox client ID | Future | — |
| `PAYPAL_CLIENT_SECRET` | PayPal Sandbox secret | Future | — |
| `PAYPAL_BASE_URL` | PayPal API base URL | Future | — |
| `ANTHROPIC_API_KEY` | Claude API key | Future | — |
| `DATABASE_URL` | PostgreSQL connection string | Future | — |

> **Security:** Never commit real credentials. The `.gitignore` excludes `.env` files. Only `.env.example` (with blank values) is tracked.

---

## 🧪 Scripts

### Root (monorepo)

| Script | Description |
|--------|-------------|
| `npm run dev:frontend` | Start Vite dev server |
| `npm run dev:backend` | Start Express with hot reload |
| `npm run build` | Build both frontend and backend |
| `npm run test` | Run backend test suite |
| `npm run install:all` | Install deps for both packages |

### Backend (`cd backend/`)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start with tsx watch |
| `npm run build` | Compile TypeScript |
| `npm run typecheck` | Type-check without emit |
| `npm test` | Run Vitest test suite |

### Frontend (`cd frontend/`)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | TypeScript check + Vite build |
| `npm run preview` | Preview production build |

---

## 🧪 Testing

```bash
# Run all backend tests
npm run test:backend

# Watch mode (from backend/)
cd backend && npm run test:watch
```

**Test coverage includes:**
- Health endpoint (status, fields, format)
- 404 handler for unknown routes
- CORS header verification
- Zod body validation (valid, missing, invalid types)
- Zod query validation (defaults, coercion, rejection)

---

## 🔒 Security & Payment Safety

1. **No production payments** are implemented in Milestone 1.
2. Future payment integration will use **PayPal Sandbox** exclusively during development.
3. PayPal secrets, API keys, and database credentials are **never exposed in frontend code**.
4. Real secrets are **never committed** to version control.
5. The AI **never independently executes** a payment capture, refund, or void.
6. Future payment actions will be controlled by a **backend policy engine** that checks:
   - Authorization state
   - User permissions
   - Explicit release policy
   - Idempotency
7. Ambiguous cases will be **escalated for human review**.
8. All payment state transitions will be recorded in an **audit trail**.

---

## 📐 API Documentation

See [docs/api-contract.md](docs/api-contract.md) for the full API specification including:
- Implemented and planned endpoints
- Request/response shapes
- Error response format
- Safety boundaries

---

## 🎯 Current Limitations

- **Sample data only** — No database persistence yet
- **No authentication** — Planned for a future milestone
- **No AI integration** — Claude API integration planned for Milestone 2
- **No PayPal integration** — Sandbox integration planned for Milestone 2
- **Static navigation** — Dashboard displays sample data, not live API responses

---

## 👥 Team

Built for the **PayPal AI Hackathon 2026** by a team of three:

| Role | Responsibility |
|------|---------------|
| Person 1 | PayPal integration & backend |
| Person 2 | AI milestone generation & submission verification |
| Person 3 | Frontend, dashboard, deployment & submission materials |

---

## 📄 License

[MIT](LICENSE)
