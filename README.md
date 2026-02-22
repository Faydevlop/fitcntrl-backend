# Gym Backend Workspace

Single repository, two separate TypeScript Express services:

- `services/platform-api`: Auth + admin + gym CRUD APIs
- `services/automation-service`: WhatsApp webhook + outbound automation APIs/workers

## Quick Start

1. Create service env files:
   - `services/platform-api/.env` from `services/platform-api/.env.example`
   - `services/automation-service/.env` from `services/automation-service/.env.example`
   - Note: required values are validated at runtime; missing keys will stop startup.
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

## Security Notes

- Protected platform routes expect:
  - `Authorization: Bearer <token>`
  - `X-User-Role: admin` for admin APIs
  - `X-User-Role: gym_owner` for gym APIs
- Protected automation routes expect:
  - `X-Internal-Token: <INTERNAL_API_TOKEN>`
