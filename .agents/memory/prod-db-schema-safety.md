---
name: Production DB schema safety for users table
description: Pattern to avoid SELECT * crashes when production DB is missing schema columns added after initial deploy
---

## Rule
Never use bare `db.select().from(usersTable)` in routes that serve user-facing login flows.

**Why:** The `banned` column was added to `usersTable` after the initial production deployment. Production DB didn't have it, causing `verify-otp` to crash with a 500 error on every login attempt.

**How to apply:**
- Use `fetchUserByPhone(phone)` and `fetchUserByVcn(vcn)` helper functions in `artifacts/api-server/src/routes/users.ts`
- These helpers try `SELECT *` first; if it fails (column missing), fall back to `safeUserCols` (explicit safe column list) and return `{ ...user, banned: false }`
- For admin-only endpoints that need `banned`, wrap in try/catch and return HTTP 503 with a clear message if the column doesn't exist yet
- Schema syncs via republish — do NOT run DDL directly on prod or add `db push` to build commands
