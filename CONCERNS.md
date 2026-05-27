# Concerns

- `server/rateLimit.ts` still uses an in-memory Map because no Redis configuration is present in `.env.example`. This resets on deploy, only protects a single process, and must be replaced with Redis before production.
