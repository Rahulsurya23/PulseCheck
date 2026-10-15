This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

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
# PulseCheck

## Supabase configuration

Account creation and API routes require a valid `SUPABASE_SERVICE_ROLE_KEY`.
Replace the placeholder in `.env.local` with the service-role key from your
Supabase project's API settings. Do not use the dashboard URL or anon key for
this value, and do not expose the service-role key to client-side code. Restart
the development server after changing environment variables:

```sh
npm run dev
```

Before registering, run `supabase/migrations/001_create_users.sql` in the
Supabase Dashboard's SQL Editor to create the application users table.

## Dashboard

Create an account or sign in at `/` to open the dashboard. Add an endpoint to
track its health, uptime, and response time; select a monitor to view its check
history and response-time chart. The dashboard refreshes monitor data every 30
seconds.

## Health check cron

The `/api/cron/health-check` route checks every active endpoint and records
health checks and incident changes. Vercel runs it every minute using the
schedule in `vercel.json`.

Set `CRON_SECRET` in the local environment and in the Vercel project settings.
Requests must include it as a bearer token:

```sh
curl http://localhost:3000/api/cron/health-check \
  -H "Authorization: Bearer $CRON_SECRET"
```
