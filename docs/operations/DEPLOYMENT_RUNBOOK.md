# Deployment and Operations Runbook
**Status:** design only; there is currently no deployed application.

## Reference topology
Local Docker Compose: `web`, `api`, `worker`, PostgreSQL. Health checks and migrations precede workers. Separate environment variables and database for this project; never reuse ClickDialog infrastructure or credentials.

## Deployment invariant
The API responds quickly and never hosts persistent workers. Worker restart must preserve queued jobs and waiting approvals. Production upgrades must be migration-safe and rollback-friendly.

## Backups & recovery
Define database backup/restore drill and retention policy before public stateful deployment. Restoration must preserve execution/audit integrity; do not treat an untested backup as recovery-ready.

## Hosting
Vercel Hobby, if used, only for permitted noncommercial frontend deployment; worker and data require separate durable hosting. Review provider terms and limits before public/commercial rollout.

## Pending gate
Pinned versions, environment matrix, secret rotation, backup retention, health probes, resource limits, metrics and disaster recovery rehearsal.
