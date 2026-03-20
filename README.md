# RelayFlow

> **Production-grade multi-channel messaging SaaS platform** — send SMS, Email, WhatsApp, and Telegram campaigns at scale, with built-in analytics, contact management, billing, and a developer SDK.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9.x-orange)](https://pnpm.io/)
[![Turborepo](https://img.shields.io/badge/Turborepo-1.x-EF4444)](https://turbo.build/)

---

## 🚀 What is RelayFlow?

RelayFlow lets SaaS teams and developers:

- **Create contacts** and segment them with tags
- **Build templates** with variable interpolation across channels
- **Launch campaigns** (SMS, Email, WhatsApp, Telegram) with scheduling and throttling
- **Track delivery** via real-time webhooks and message events
- **Manage billing** with Stripe — tiered plans with usage-based overages
- **Integrate easily** via the typed SDK or REST API
- **Comply with regulations** — consent records, opt-outs, audit logs

---

## 🏗 Tech Stack

| Layer | Technology |
|---|---|
| **Monorepo** | pnpm workspaces + Turborepo |
| **Language** | TypeScript 5.4 (strict mode everywhere) |
| **API** | Fastify + tRPC |
| **Frontend** | Next.js 14 (App Router) + Tailwind CSS |
| **Database** | PostgreSQL via Neon + Prisma ORM |
| **Cache / Queue** | Redis via Upstash + BullMQ |
| **Auth** | JWT (access + refresh tokens) + API keys |
| **Email** | Resend |
| **SMS / WhatsApp** | Twilio |
| **Telegram** | Telegram Bot API |
| **Billing** | Stripe |
| **Logging** | Pino |
| **Validation** | Zod |
| **Testing** | Vitest |
| **Deployment** | Vercel (frontend) + Fly.io (API) |

---

## 📁 Repository Structure

```
relayflow/
├── apps/
│   ├── api/                  # Fastify REST + tRPC API server
│   │   └── prisma/           # Prisma schema & migrations
│   └── web/                  # Next.js 14 dashboard (App Router)
│
├── packages/
│   ├── types/                # Shared TypeScript types & interfaces
│   ├── validators/           # Zod validation schemas
│   ├── config/               # Shared configuration utilities
│   ├── logger/               # Pino-based structured logger
│   ├── email/                # Email sending helpers (Resend)
│   └── sdk/                  # TypeScript SDK for API consumers
│
├── turbo.json                # Turborepo pipeline
├── pnpm-workspace.yaml       # pnpm workspaces
├── tsconfig.base.json        # Base TypeScript config
└── .env.example              # Environment variable template
```

---

## ⚡ Quick Start

### Prerequisites

- **Node.js** >= 20
- **pnpm** >= 9  (`npm install -g pnpm@9`)
- **PostgreSQL** (local or Neon free tier)
- **Redis** (local or Upstash free tier)

### 1. Clone & Install

```bash
git clone https://github.com/your-org/relayflow.git
cd relayflow
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env and fill in your credentials
```

Key variables to set immediately:

| Variable | Description |
|---|---|
| DATABASE_URL | Neon / local PostgreSQL connection string |
| REDIS_URL | Upstash / local Redis URL |
| JWT_SECRET | Random 64-byte base64 string |
| JWT_REFRESH_SECRET | Random 64-byte base64 string |
| RESEND_API_KEY | From resend.com |
| STRIPE_SECRET_KEY | From Stripe dashboard |

Generate secrets:
```bash
openssl rand -base64 64   # JWT_SECRET and JWT_REFRESH_SECRET
openssl rand -hex 32      # ENCRYPTION_KEY
```

### 3. Database Setup

```bash
pnpm db:generate   # Generate Prisma client
pnpm db:migrate    # Run migrations
pnpm db:seed       # Seed with demo data
```

### 4. Run Locally

```bash
pnpm dev   # Start all apps (API :4000, Web :3000)
```

---

## 🚢 Deployment

### API → Fly.io

```bash
cd apps/api
fly launch --name relayflow-api
fly secrets set DATABASE_URL="..." JWT_SECRET="..."
fly deploy
```

### Web → Vercel

```bash
cd apps/web
vercel --prod
```

### Database → Neon

1. Create project at neon.tech
2. Copy connection string to DATABASE_URL
3. Run `pnpm db:migrate`

### Redis → Upstash

1. Create Redis database at upstash.com
2. Copy URL to REDIS_URL

---

## 📦 Packages

| Package | Description |
|---|---|
| @relayflow/types | Shared TypeScript interfaces & enums |
| @relayflow/validators | Zod schemas for all API inputs |
| @relayflow/config | Config utilities & env parsing |
| @relayflow/logger | Pino structured logger factory |
| @relayflow/email | Email sending via Resend |
| @relayflow/sdk | Client SDK for RelayFlow API consumers |

---

## 📄 License

MIT © RelayFlow Inc.
