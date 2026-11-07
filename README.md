# NEXUS AI

> **Multi-Tenant AI-Powered Business Operations & Customer Support SaaS**

NEXUS AI is an enterprise-grade multi-tenant platform designed to manage customer support operations, internal knowledge, business analytics, and AI-assisted workflows with human-in-the-loop safety.

---

## 🏛️ Architecture Overview

- **`apps/api`**: Primary Backend built with **NestJS**, Prisma ORM, BullMQ, and Socket.IO.
- **`apps/ai-service`**: AI Processing Service built with **Python & FastAPI**, implementing RAG with **pgvector**.
- **`apps/web`**: Multi-role frontend portal built with **Next.js**, React, and Tailwind CSS.
- **Database & Queue**: PostgreSQL 16 (with `pgvector` extension) and Redis 7.

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- Docker & Docker Compose
- Node.js (v20+)
- Python (3.11+)

### 2. Setup Environment
```bash
cp .env.example .env
```

### 3. Start Database & Redis via Docker
```bash
npm run docker:up
```

Verify services:
```bash
npm run db:wait      # Checks PostgreSQL & pgvector health
npm run redis:ping   # Checks Redis connectivity (responds with PONG)
```

### 4. Stopping Containers
```bash
npm run docker:down
```

---

## 📖 Documentation
- [PRD.md](PRD.md): Product Requirements Document
- [ROADMAP.md](ROADMAP.md): Detailed 10-Phase Implementation Roadmap
