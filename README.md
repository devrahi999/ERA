# Esporta Recommendation Admin

Admin panel for the Esporta Recommendation Engine. Allows authorized Super Admins to monitor, inspect, configure, debug, test, and safely control the recommendation system.

## Project Purpose
Phase 2 of the recommendation engine roadmap: a dedicated Next.js application that provides an operational control center.

## Stack
- Next.js 16 (App Router)
- React
- TypeScript
- Tailwind CSS
- TanStack Query (React Query)
- Zod
- Lucide React

## Setup & Running
1. Install dependencies: `npm install`
2. Configure `.env.local`: `cp .env.local.example .env.local`
3. Run development server: `npm run dev`
4. Build for production: `npm run build`

## Environment Variables
- `NEXT_PUBLIC_API_BASE_URL`: The URL of the `esporta-backend` API (e.g. `http://localhost:3000/api/v1`).

## Authentication & Authorization
- **Super Admin Requirement**: The panel is STRICTLY for Super Admin users.
- **Flow**: User logs in via the Next.js frontend, which calls the Esporta backend. The backend issues a token which is saved in a cookie and `localStorage`.
- **Protection**: 
  - Next.js Middleware (`proxy.ts`) protects routes from unauthenticated users.
  - The backend provides the *actual* authorization and capabilities checks.

## Architecture
See `/docs/architecture.md` for a detailed breakdown.
All Phase 2 requirements implemented.
