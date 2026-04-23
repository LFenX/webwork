This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

This app uses PostgreSQL through Prisma. Create a dedicated local database such as
`webappwork_dev`, then copy `.env.example` to `.env` and set `DATABASE_URL`.
If you plan to use the AI Assistant module, also set `AI_SECRET_KEY`.
Do not hard-code the PostgreSQL password in source files.

```bash
npm install
npm run db:generate
npm run db:migrate
```

To migrate existing local SQLite data from `dev.db` into PostgreSQL:

```bash
npm run db:migrate:sqlite-to-postgres
```

The migration script refuses to import into a non-empty PostgreSQL database unless
you pass `--truncate`, which should only be used after taking a backup.

Then run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

See `docs/postgres-migration.md` for the migration audit, validation checklist,
risk register, and rollback notes. See `docs/ai-assistant.md` for the AI module
setup, permission boundary, and validation checklist.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
