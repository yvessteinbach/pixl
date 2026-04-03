# Pixl Product Readiness Tasks

This file is the working source of truth for turning Pixl from a promising prototype into a secure, public-facing product.

## Current Status

- Control plane: early prototype
- Build plane: runs inside app process
- Runtime plane: single-host Docker model
- Database: SQLite
- Networking: local/VPS mix, no stable wildcard routing layer yet
- Security posture: basic auth and webhook verification, not production-grade yet

## Now

- [x] Track deployment history with a `Deployment` model
- [x] Keep one stable local port per site across redeploys
- [x] Improve webhook registration updates when the public tunnel URL changes
- [x] Add basic environment and deploy-request validation
- [x] Add baseline HTTP security headers
- [ ] Add a stable wildcard subdomain router for `*.pixl.com`
- [ ] Replace tunnel-dependent local webhook flow with a VPS-first webhook ingress
- [ ] Add a manual "Reconnect Webhook" action in the dashboard
- [ ] Surface webhook delivery errors and build errors clearly in the UI
- [ ] Add commit SHA, branch, and deployment logs to the deployment detail view

## Phase 1: Production Foundations

- [ ] Replace SQLite with PostgreSQL
- [ ] Add Prisma migrations to the repo instead of relying on `db push`
- [ ] Add `.env.example` with every required variable documented
- [ ] Enforce environment validation at startup
- [ ] Add structured logging with request/deployment correlation IDs
- [ ] Add rate limiting on auth-sensitive and webhook endpoints
- [ ] Add audit logs for deploy, redeploy, delete, and webhook actions
- [ ] Add server-side input validation for every API route

## Phase 2: Networking And Domains

- [ ] Introduce a reverse proxy or ingress layer on the public VPS
- [ ] Support wildcard subdomains like `project.pixl.com`
- [ ] Store canonical production hostname separately from internal port
- [ ] Add custom domain verification flow
- [ ] Add automatic TLS provisioning
- [ ] Split public edge routing from private runner networking
- [ ] Move app-to-runner traffic onto private networking, VPN, or WireGuard

## Phase 3: Build And Runtime Isolation

- [ ] Move builds out of the Next.js app process into worker jobs
- [ ] Add a queue for deploy, redeploy, destroy, and health-check tasks
- [ ] Run builds on dedicated runner machines instead of the web server
- [ ] Store build artifacts or container images in durable storage
- [ ] Add deployment health checks, retries, and timeout policies
- [ ] Add resource limits for CPU, memory, and disk usage per deployment
- [ ] Add cleanup jobs for old images, stopped containers, and stale repos

## Phase 4: Security

- [ ] Replace personal OAuth-token webhook management with a GitHub App
- [ ] Minimize repo permissions to the least privilege necessary
- [ ] Encrypt secrets at rest
- [ ] Add per-project secret management with rotation support
- [ ] Run deployments with stronger container isolation defaults
- [ ] Add image scanning and dependency scanning
- [ ] Add abuse protections for public signups and deploy spam
- [ ] Add SSO/SAML roadmap for business customers
- [ ] Document Swiss hosting, data residency, and incident response posture

## Phase 5: Product Features

- [ ] Add preview deployments per commit or PR
- [ ] Add real rollbacks to previous immutable deployments
- [ ] Add deployment logs and build output streaming
- [ ] Add team/org support
- [ ] Add usage limits, plans, and billing
- [ ] Add project analytics and observability
- [ ] Add deploy hooks and API tokens
- [ ] Add CLI support for power users

## Architecture Direction

- Control plane:
  Pixl app, auth, database, billing, project config, domain config
- Build plane:
  queue + workers that clone, build, and publish artifacts
- Runtime plane:
  runner nodes that start immutable deployments
- Edge plane:
  wildcard DNS + reverse proxy + TLS termination

## Recommended Next Step

Implement wildcard subdomain routing so every site gets a stable hostname and deployments stop being represented as visible ports.
