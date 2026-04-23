# AI Assistant Module

## Scope

This document covers the v1 AI Assistant foundation that was added to the app:

- `/ai` entry in the main navigation
- persistent conversations and messages
- OpenAI-compatible personal provider settings
- free-access requests and admin grants
- controlled read-only business tools
- reasoning summary and tool trace UI
- audit and tool-call logs

## Environment

Add the following to `.env`:

```bash
AI_SECRET_KEY="replace-with-a-32-byte-random-secret"
```

Notes:

- `AI_SECRET_KEY` is used to encrypt personal and admin-managed API keys at rest.
- Keep it stable across deploys. Rotating it without a re-encryption flow will invalidate stored keys.

## Database

The database change set is stored in:

`prisma/migrations/20260424123000_ai_assistant_foundation/migration.sql`

Apply it with the normal Prisma flow:

```bash
npm run db:generate
npm run db:migrate
```

## Runtime Flow

For each user message:

1. Verify login and AI availability.
2. Resolve the effective provider source:
   - enabled personal config
   - otherwise active admin grant
   - otherwise deny usage
3. Persist the user message and a streaming assistant placeholder.
4. Select controlled tools based on the prompt.
5. Execute tools inside the server-only tool layer.
6. Record every tool call in `AIToolCallLog`.
7. Generate the final answer:
   - first choice: configured OpenAI-compatible provider
   - fallback: structured summary from tool results
8. Persist the final assistant message with reasoning summary and tool trace summary.

## Permission Boundary

The AI tool boundary is intentionally narrower than direct database access:

- tools are server-only and whitelist-based
- the model never builds SQL
- cross-user page access reuses `getAccessLevel`, `canViewModule`, and `visibleTo`
- admins can manage requests/grants, but do not automatically read user conversations

## Included v1 Tools

- `get_my_profile`
- `get_my_settings`
- `get_my_resume_overview`
- `get_my_jobs_overview`
- `get_my_interviews_overview`
- `get_my_posts_overview`
- `get_my_uploads_overview`
- `get_my_friends_overview`
- `get_my_chat_summary`
- `get_visible_user_page_overview`

## Validation Checklist

Use this checklist after applying the migration:

1. `npm run db:generate`
2. `npm run db:migrate`
3. `npm run lint`
4. `npm run build`
5. Log in as a normal user and verify:
   - `/ai` loads
   - a conversation can be created
   - messages persist after refresh
   - settings can be saved and tested
   - access-request submission works when no provider is available
6. Log in as an admin with `manageAI` and verify:
   - AI panel appears in `/admin`
   - request approve/reject works
   - grant save/pause/revoke works
7. Verify safety behavior:
   - revoked or paused grants stop AI access immediately
   - cross-user overview only returns modules visible under existing page permissions
   - tool traces reflect only executed tools
   - provider failure falls back to structured summary instead of exposing raw errors as system state

## Known Follow-ups

- tool selection is currently heuristic and should later move to a more explicit planner/tool-calling protocol
- there is no key-rotation migration yet for `AI_SECRET_KEY`
- automated integration tests are still missing; current verification is build-time plus manual checklist
