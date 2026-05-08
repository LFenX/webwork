# AGENTS.md - SQL Guardian Implementation Guide

> This file can be copied into the repository root as `AGENTS.md`, or merged into the existing `AGENTS.md`. It gives Codex project-specific instructions for implementing SQL Guardian.

## Project Context

This is a Next.js App Router + React + TypeScript + Tailwind CSS + Prisma + PostgreSQL personal digital workspace platform.

The platform already includes:

- Home dashboard
- Blog / daily / notes / insights content system
- Resume builder
- Job application and interview tracking
- Friends, chat, channels, announcements
- Community resources and stickers
- SoulWing AI assistant with tools, memory, permissions and audit logs
- SQL Lab with editor, schema tree, query execution, SQL Assistant, permissions and audit
- Admin governance features

SQL Guardian must extend existing platform capabilities. Do not build it as an isolated app.

## SQL Guardian Goal

Build a 2D animated AI guardian that lives in the website.

It should:

- Have a home near the SQL Assistant in SQL Lab.
- Appear across the whole website as a low-interruption companion.
- Support basic states: idle, walk, jump, think, talk, happy, confused, sleep, teleport, level-up.
- Have per-user profile, level, experience, mood, personality and memories.
- Chat with the user.
- Share authorized low-risk context with SoulWing / 蝶灵.
- Influence SQL Assistant answer style without changing SQL safety rules.

## Hard Rules

- Do not bypass existing auth.
- Do not bypass SQL Lab permissions.
- Do not bypass table authorization, column masking, row filtering or SQL audit.
- Do not let SQL Guardian execute SQL directly unless it goes through existing SQL Lab APIs and safety checks.
- Do not create a separate AI provider if the project already has one.
- Do not expose or store secrets.
- Do not save passwords, tokens or API keys as Guardian memories.
- Do not read or return other users' Guardian data.
- Do not inject high-sensitivity memories into AI prompts.
- Do not copy or imitate any copyrighted anime character design.
- Do not introduce a large animation dependency without explaining why.
- Do not make broad rewrites of SQL Lab, SoulWing or App Shell unless the task explicitly requires it.

## Implementation Style

- Work in small PR-sized steps.
- Read `docs/sql-guardian/*` before coding.
- Start with a code scan task before modifying files.
- Prefer existing project conventions over the suggested paths in docs.
- Use TypeScript types for Guardian state, profile, memory and events.
- Keep Guardian UI optional and dismissible.
- Respect `prefers-reduced-motion`.
- Keep SQL Assistant persona context compact.
- Keep character roleplay light in technical answers.

## Suggested Commands

Run after each task:

```bash
npm run lint
npm run build
npx prisma generate
```

Run when Prisma schema changes:

```bash
npx prisma format
npx prisma migrate dev
```

If the project has test commands, run them too.

## Required Reporting Format

After each task, report:

```md
## Completed

## Modified Files

## Commands Run

## Verification

## Risks / Follow-ups
```

If any command fails, explain the failure and do not continue adding unrelated features.

## SQL Guardian Phases

1. Code scan only, no changes.
2. Frontend skeleton with mock data.
3. SQL Lab Guardian home entrance.
4. Animation state machine.
5. Prisma models and services.
6. Profile and event APIs.
7. Chat API.
8. Memory API.
9. SQL Assistant persona integration.
10. SoulWing shared context.
11. Settings, reset, mobile and testing.

## Safety Reminder

SQL Guardian is allowed to be warm, playful and story-rich. But when it helps with SQL or user data, correctness, privacy and permissions come first.
