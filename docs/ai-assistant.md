# AI Assistant Module

## Scope

This document describes the v2 AI assistant upgrade:

- `/ai` persistent conversations
- personal provider settings and admin grants
- white-listed server-only data tools
- controlled admin-delegated lookup
- streaming run timeline with compact and developer views
- audit logs and tool-call logs

## Environment

Add the following to `.env`:

```bash
AI_SECRET_KEY="replace-with-a-32-byte-random-secret"
```

`AI_SECRET_KEY` encrypts personal and admin-managed provider credentials at rest.

## Database

Relevant migrations:

- `prisma/migrations/20260424123000_ai_assistant_foundation/migration.sql`
- `prisma/migrations/20260424150000_ai_assistant_v2_runs/migration.sql`

Apply with:

```bash
npm run db:generate
npm run db:migrate
```

## Runtime Flow

For each user prompt:

1. Verify login and AI availability.
2. Create the user message, assistant placeholder, and `AIRun`.
3. Build a controlled execution plan.
4. Execute server-only tools inside the allowed scope:
   - `self`
   - `admin-delegated`
   - `visible-user`
5. Persist tool calls in `AIToolCallLog`.
6. Persist run phases in `AIRunStep`.
7. Generate the final answer:
   - preferred: configured OpenAI-compatible provider
   - fallback: structured summary from tool results
8. Persist the final assistant message and mark the run completed or failed.

## Permission Boundary

The assistant still does not receive direct database access:

- tools are white-listed and server-only
- the model never builds SQL
- admin-delegated tools reuse existing admin permission boundaries
- visible-user tools reuse existing page visibility rules
- raw high-sensitivity data is minimized in tool output where possible

## Tool Coverage

Current v2 tool groups:

- self profile / settings / resume / jobs / interviews / posts / uploads
- self friends overview and detail
- self chat summary / chat thread overview / chat search / thread messages
- self sessions overview
- self activity log
- visible user page overview
- admin user profile overview
- admin user activity log
- admin user sessions

## UI Modes

The assistant UI supports two presentation modes:

- Compact: show the answer first with a few execution chips
- Developer: show the full timeline with plan, tool steps, verification, and final generation

Historical assistant messages can reload their run details from:

- `GET /api/ai/runs/:messageId`

## Validation Checklist

1. `npm run db:generate`
2. `npm run db:migrate`
3. `npm run lint`
4. `npm run build`
5. Verify as a normal user:
   - `/ai` loads
   - conversations persist
   - compact and developer mode both render
   - self chat / friend / session / activity prompts work
6. Verify as an admin with relevant permissions:
   - admin-delegated prompts return data only when permissions allow
   - denied prompts do not leak target data
7. Verify failure handling:
   - provider failure still shows timeline and fallback answer
   - completed runs reload from message history

## Known Follow-ups

- the planner is still heuristic and can later move to a more explicit tool-calling protocol
- automated integration coverage is still missing
- high-sensitivity tool redaction can be refined further per tool
