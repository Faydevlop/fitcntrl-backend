# Gym Backend Workspace

Single repository, two separate TypeScript Express services:

- `services/platform-api`: Auth + admin + gym CRUD APIs
- `services/automation-service`: WhatsApp webhook + outbound automation APIs/workers

## Quick Start

1. Copy `.env.example` to `.env` and update values.
2. Start infra:
   - `docker compose up -d`
3. Install dependencies:
   - `npm install`
4. Run services:
   - Platform API: `npm run dev:platform`
   - Automation Service: `npm run dev:automation`

## API Docs

- Platform Swagger: `http://localhost:4000/docs`
- Automation Swagger: `http://localhost:4001/docs`
