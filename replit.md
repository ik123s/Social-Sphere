# Chivra

A WhatsApp-style AI social network where each contact is an autonomous AI agent with memory, personality, relationship states, and initiative behavior.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, served at /api)
- `pnpm --filter @workspace/chivra run dev` — run the Chivra frontend (served at /)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, Framer Motion, Wouter routing, shadcn/ui
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- AI: OpenAI GPT via Replit AI Integrations (gpt-5.1 for chat, gpt-5-nano for memory extraction, gpt-image-1 for avatars)
- Validation: Zod (zod/v4), drizzle-zod
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — single source of truth for all API contracts
- `lib/db/src/schema/` — Drizzle DB schema: contacts, relationships, memories, chatMessages, statusPosts, conversations, messages, users, userConnections
- `lib/api-client-react/src/generated/` — generated React Query hooks (do not edit)
- `lib/api-zod/src/generated/` — generated Zod schemas (do not edit)
- `artifacts/api-server/src/routes/` — Express route handlers (contacts, relationships, chatMessages, memory, status, dashboard, openai, users)
- `artifacts/chivra/src/pages/` — frontend pages (onboarding, splash, chat-list, chat-screen, contact-profile, status-feed, new-contact, profile)
- `artifacts/chivra/src/lib/onboarding.ts` — onboarding completion flag helpers (localStorage)
- `artifacts/chivra/src/lib/vcn.ts` — VCN init/storage helpers

## Architecture decisions

- Each AI contact has an independent personality prompt built from: name, gender, tone, language style, emotional behavior, relationship state, and memory facts.
- Chat messages are sent via raw fetch SSE streaming to `/api/contacts/:id/messages` — NOT via generated hooks (SSE requires manual fetch).
- Memory extraction runs as a background fire-and-forget call after each AI response (gpt-5-nano), keeping the main chat stream fast.
- Contact `activityState` is set to "thinking" during AI generation and restored to "online" after.
- OTP verification is simulated server-side (in-memory Map, no real SMS) — the OTP is returned in the API response for demo purposes.
- Voice notes use browser MediaRecorder API → base64 data URL → stored in chatMessages.content with messageType "audio".
- Image sharing uses FileReader → base64 data URL → stored in chatMessages.content with messageType "image".
- Status posts are filtered to last 24 hours on the backend using a `gte(createdAt, since24h())` clause.

## Product

- **Onboarding flow**: 5-stage WhatsApp-style (phone + country code → OTP verification → email setup → profile setup → animated initialization screens)
- Chat list (WhatsApp-style) with unread badges, last message preview, and activity state indicators
- Full chat screen with real-time streaming AI responses, typing indicator, voice notes (mic button), and image sharing
- Relationship progression: STRANGER → FRIEND → BEST FRIEND → PARTNER
- AI memory: each contact remembers facts about the user across conversations
- Status feed: AI contacts post thoughts and updates visible in a social feed (24h expiry)
- Contact profiles with bio, relationship state, personality info, and memory display
- Create new AI contacts with custom personality configuration
- AI-generated avatar images via OpenAI image generation
- VCN (Virtual Chat Number) system for user discovery — each user gets a unique 7-char ID

## User preferences

- App name: Chivra
- Dark, violet/purple aesthetic — like dark mode Instagram crossed with WhatsApp
- No emojis in the UI
- AI contacts should feel like real social beings, not chatbots

## Gotchas

- After OpenAPI spec changes: run `pnpm --filter @workspace/api-spec run codegen` before using updated types
- The `integrations-openai-ai-server` lib's `pRetry.AbortError` was fixed to use named import `{ AbortError }` (p-retry v7 API change)
- Always import React hooks (`useState`, `useEffect`, etc.) from `"react"`, never from `"wouter"`
- SSE chat endpoint: use raw fetch, not the generated `useSendMessage` hook
- OTP store is in-memory (Map) — restarting the API server clears pending OTPs
- Voice note messages don't trigger AI responses (only text messages do)

## Pointers

- See `pnpm-workspace` skill for workspace structure and TypeScript setup
- See `.local/skills/ai-integrations-openai/SKILL.md` for OpenAI integration details
