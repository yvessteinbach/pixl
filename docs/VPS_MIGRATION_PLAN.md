# Pixl VPS Migration Plan

This guide is for migrating the current Pixl app to a VPS without redesigning the product first.

It reflects the current codebase:

- Next.js app acts as the control plane
- Docker builds and runs customer apps on the same machine
- GitHub webhooks hit `POST /api/webhook/github`
- Prisma currently uses SQLite
- Customer repos and deployment artifacts are stored on local disk under `customers/`

## Goal For The First Migration

Move the existing single-machine architecture onto one VPS so that:

- Pixl itself is publicly reachable on one stable domain
- GitHub webhooks hit the VPS directly
- Pixl can run Docker builds and containers locally on that VPS
- You stop depending on localtunnel for production-like usage

This is the right first step before doing the larger readiness items like PostgreSQL, queues, runner separation, and wildcard routing.

## Current Constraints You Should Accept For Version 1

Before migrating, it helps to be explicit about what is still true:

- SQLite is still a single-file database
- Builds still run inside the app flow on the same server
- Customer source code is stored on the VPS filesystem
- Customer containers are published by Docker on random high ports
- There is not yet a stable wildcard router for `*.pixl.com`

That means your first VPS rollout is suitable for early private/beta usage, not a fully hardened multi-tenant production platform yet.

## Recommended VPS Architecture Right Now

Use one VPS with:

- `nginx` or `Caddy` in front
- Pixl app running with `npm run build` and `npm run start`
- Docker installed on the same VPS
- Persistent app directory for:
  - the SQLite database file
  - `customers/`
  - deployment logs

Suggested layout:

```text
/srv/pixl/app
/srv/pixl/data
/srv/pixl/data/dev.db
/srv/pixl/app/customers
```

Use a reverse proxy so only Pixl itself is public on ports `80` and `443`.

## What To Deploy First

Deploy the Pixl control plane first, not customer subdomains yet.

Use one hostname such as:

- `pixl.yourdomain.com`

Set `PIXL_PUBLIC_URL` to that public HTTPS URL so webhook registration points to:

- `https://pixl.yourdomain.com/api/webhook/github`

This alone removes the tunnel dependency for webhook delivery.

## Required Environment Variables

From the current codebase, these are required or effectively required:

- `DATABASE_URL`
- `AUTH_GITHUB_ID`
- `AUTH_GITHUB_SECRET`
- `PIXL_PUBLIC_URL`
- `WEBHOOK_SECRET`
- `AUTH_SECRET`

Suggested values for the current SQLite setup:

```env
DATABASE_URL="file:/srv/pixl/data/dev.db"
PIXL_PUBLIC_URL="https://pixl.yourdomain.com"
WEBHOOK_SECRET="generate-a-long-random-secret"
AUTH_GITHUB_ID="github-oauth-app-client-id"
AUTH_GITHUB_SECRET="github-oauth-app-client-secret"
AUTH_SECRET="generate-a-long-random-secret"
NODE_ENV="production"
```

## VPS Setup Sequence

1. Provision the VPS.
2. Install Docker, Node.js 20+, npm, git, and nginx or Caddy.
3. Point DNS for `pixl.yourdomain.com` to the VPS.
4. Clone this repo onto the VPS.
5. Create persistent directories for the app, SQLite file, and `customers/`.
6. Add the production `.env`.
7. Install dependencies with `npm ci`.
8. Build Pixl with `npm run build`.
9. Start Pixl behind a process manager like `systemd` or `pm2`.
10. Put nginx or Caddy in front for TLS and reverse proxying to the Next.js app.
11. Log in with GitHub and test webhook registration from the VPS URL.
12. Run one real deployment and confirm Docker can build and start customer containers.

## Reverse Proxy Shape

For the first migration, proxy only the Pixl app:

- public `443` -> Pixl app on `127.0.0.1:3000`

Do not expose random Docker ports directly to the internet long-term. For an initial private setup, you can test customer apps by reaching `http://VPS_IP:PORT`, but that should be treated as temporary.

## Process Management

Run Pixl as a long-lived service with automatic restart.

Good options:

- `systemd` on the VPS
- `pm2` if you prefer Node-oriented process management

`systemd` is usually the cleanest choice for a VPS.

## Persistence You Must Not Lose

Back up these paths:

- the SQLite database file referenced by `DATABASE_URL`
- `/srv/pixl/app/customers`
- any deployment log directory used by the app

If you rebuild the server without preserving those, you lose app state, cloned repos, and deployment history/logs.

## What Is Safe To Launch On The VPS Immediately

You can safely move these parts now:

- Pixl web UI
- GitHub OAuth login
- GitHub webhook ingress
- Docker-based build and run flow
- manual and automatic redeploys

This is enough to start migrating and testing on one VPS.

## What Should Be Your Next Hardening Steps

Based on `docs/PRODUCT_READINESS_TASKS.md`, the next three practical milestones are:

1. Replace tunnel/webhook-local flow with the VPS public URL
2. Add a stable public routing layer for deployed customer apps
3. Replace SQLite with PostgreSQL

That order makes sense for your current codebase.

## Recommended Migration Phases

### Phase A: Lift-And-Shift

Goal:

- run the current app on the VPS with the least architecture change

Do now:

- deploy Pixl itself
- point `PIXL_PUBLIC_URL` at the VPS domain
- verify GitHub OAuth and webhook delivery
- verify Docker builds work on the VPS

### Phase B: Stable Site Routing

Goal:

- stop representing customer deployments as raw ports

Do next:

- add reverse proxy rules that map hostnames to each deployment port
- introduce wildcard DNS like `*.pixl.yourdomain.com`
- route `project.pixl.yourdomain.com` to the correct internal Docker port

This corresponds directly to the readiness item:

- add a stable wildcard subdomain router for `*.pixl.com`

### Phase C: Data And Reliability

Goal:

- make the control plane less fragile

Do after routing:

- migrate Prisma from SQLite to PostgreSQL
- commit real Prisma migrations
- add `.env.example`
- validate env vars at startup
- add better logging and rate limiting

## Biggest Risks If You Migrate Today Without Changes

- SQLite can become a bottleneck or failure point
- one VPS now handles web traffic, builds, and runtime containers
- Docker builds from untrusted repos happen on the same machine as the control plane
- deployed customer apps still lack a proper wildcard edge layer
- there is no queue isolating long builds from request handling

These are important, but they should not stop a first controlled migration if usage is still low.

## Practical Recommendation

If your goal is to start migrating now, do this:

1. Put Pixl itself on the VPS behind HTTPS
2. Set `PIXL_PUBLIC_URL` to the VPS domain
3. Keep the current single-box Docker architecture for now
4. Test end-to-end deploys from GitHub
5. Make wildcard routing your next implementation task
6. Make PostgreSQL the hardening task after routing works

That path gets you out of local/tunnel mode quickly without forcing a full platform rewrite first.
