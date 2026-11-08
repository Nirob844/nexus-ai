.PHONY: help setup dev up down logs api ai web build db-seed db-migrate db-wait kill-ports clean

# Colors for terminal output
CYAN   := $(shell which tput >/dev/null 2>&1 && tput -Txterm setaf 6 || echo "")
GREEN  := $(shell which tput >/dev/null 2>&1 && tput -Txterm setaf 2 || echo "")
YELLOW := $(shell which tput >/dev/null 2>&1 && tput -Txterm setaf 3 || echo "")
RESET  := $(shell which tput >/dev/null 2>&1 && tput -Txterm sgr0 || echo "")

help: ## Show this interactive help menu
	@echo ''
	@echo '${CYAN}NEXUS AI — Enterprise Polyglot SaaS Monorepo${RESET}'
	@echo 'Usage: ${YELLOW}make${RESET} ${GREEN}<target>${RESET}'
	@echo ''
	@echo 'Available commands:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  ${YELLOW}%-15s${RESET} %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ''

setup: ## Install dependencies for all apps (API, AI Service, Web)
	@echo "${GREEN}Installing Node dependencies (NestJS & Next.js)...${RESET}"
	@yarn --cwd apps/api install
	@yarn --cwd apps/web install
	@echo "${GREEN}Setting up Python 3.14 virtual environment...${RESET}"
	@test -d apps/ai-service/.venv || python3 -m venv apps/ai-service/.venv
	@apps/ai-service/.venv/bin/pip install -r apps/ai-service/requirements.txt
	@echo "${GREEN}Generating Prisma client...${RESET}"
	@yarn --cwd apps/api prisma generate
	@echo "${CYAN}✅ Monorepo setup complete!${RESET}"

dev: up ## Start Docker and run all 3 services concurrently (NestJS API, FastAPI AI, Next.js Web)
	@echo "${YELLOW}Checking and freeing ports 4000, 8000, 3000...${RESET}"
	@fuser -k 4000/tcp 8000/tcp 3000/tcp 2>/dev/null || true
	@echo "${GREEN}🚀 Booting all 3 NEXUS AI services (API:4000, AI:8000, WEB:3000)...${RESET}"
	@yarn dev

kill-ports: ## Force terminate any running processes on ports 4000, 8000, and 3000
	@echo "${YELLOW}Freeing ports 4000, 8000, 3000...${RESET}"
	@fuser -k 4000/tcp 8000/tcp 3000/tcp 2>/dev/null || true
	@echo "${GREEN}Ports freed.${RESET}"

up: ## Start Docker containers (PostgreSQL:5433, Redis:6380)
	@docker compose up -d

down: ## Stop Docker containers
	@docker compose down

logs: ## View real-time logs from Docker containers
	@docker compose logs -f

db-wait: ## Wait until PostgreSQL is ready to accept connections
	@docker compose exec -T postgres pg_isready -U postgres -d nexus_ai

db-migrate: ## Push Prisma schema to PostgreSQL database
	@yarn --cwd apps/api prisma db push

db-seed: ## Seed database with demo tenants, users, permissions, and handbook
	@yarn --cwd apps/api prisma db seed

api: ## Run NestJS API server in dev mode (port 4000)
	@yarn --cwd apps/api start:dev

ai: ## Run FastAPI AI microservice with auto-reload (port 8000)
	@apps/ai-service/.venv/bin/uvicorn app.main:app --app-dir apps/ai-service --host 0.0.0.0 --port 8000 --reload

web: ## Run Next.js frontend web application in dev mode (port 3000)
	@yarn --cwd apps/web dev

build: ## Build both API and Web production bundles
	@echo "${GREEN}Building NestJS API...${RESET}"
	@yarn --cwd apps/api build
	@echo "${GREEN}Building Next.js Web...${RESET}"
	@yarn --cwd apps/web build
	@echo "${CYAN}✅ All production builds succeeded!${RESET}"

clean: ## Stop Docker containers and delete volumes
	@docker compose down -v
