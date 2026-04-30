@AGENTS.md

# CLAUDE.md

## Core Behavior

Before editing code:

* Read the relevant existing files first.

* Do not silently assume requirements. If something is ambiguous, state the assumption briefly.

* Prefer small, targeted changes.

* Do not rewrite large modules unless explicitly requested.

* Do not add unrelated features, abstractions, settings, or configurability.

* Every changed line should directly relate to the user's request.

* Match the existing code style, UI style, and architecture.

* If you notice unrelated problems, mention them instead of changing them.

## Simplicity First

* Implement the minimum solution that solves the actual problem.

* Avoid over-engineering.

* Avoid speculative future-proofing.

* Avoid creating new abstractions for one-time use.

* Do not introduce new dependencies unless there is a clear reason.

## Surgical Changes

When fixing bugs:

* First identify the root cause.

* Then change only the necessary files.

* Do not refactor nearby code unless the refactor is required for the fix.

* Do not remove existing features unless explicitly requested.

* Do not change database schema, auth logic, or permissions without explaining the risk.

## Verification

After changes:

* Run the most relevant checks when possible.

* For this Next.js project, prefer:

  * npm run build

  * npm run lint

  * npx prisma validate

* If a command cannot be run, explain why and suggest the exact command the user should run.

## Project-Specific Rules

This project includes:

* Next.js App Router

* Prisma / PostgreSQL

* AI assistant configuration

* resume module

* job/interview tracking

* blog/community/site sharing features

* admin and user permission logic

Be especially careful with:

* AI provider authorization

* API key handling

* admin permission logic

* SSE / streaming rendering

* Prisma migrations

* resume template rendering

* user privacy and token usage statistics

## UI Rules

* Keep the UI modern, minimal, Apple-like, and information-dense.

* Prefer card-based layout, soft shadows, light dividers, and clean spacing.

* Do not make dropdowns, dialogs, or panels transparent unless intentionally designed.

* Mobile and desktop layouts must both be considered.

* Avoid changing visual style globally unless explicitly requested.

