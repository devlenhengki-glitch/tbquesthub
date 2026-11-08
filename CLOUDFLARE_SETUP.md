# TBQuestHub Cloudflare Pages setup

This patch adds Cloudflare Pages Functions for the existing tRPC competition API, a D1 database schema, and D1-backed small flyer storage. The original website styling remains unchanged.

1. In Cloudflare dashboard > Workers & Pages > tbquesthub > Settings > Variables and Secrets, add **ACADEMIC_DIVISION_PASSWORD** as an encrypted secret for Production. Use a long unique password, not your GitHub password. Never put it in code or screenshots.
2. In Cloudflare dashboard > Storage & databases > D1 > tbquesthub-db > Console, execute the statements in `cloudflare/schema.sql` once. The existing Pages binding **DB** -> **tbquesthub-db** is already configured.
3. Upload this updated source to the **main** branch of `devlenhengki-glitch/tbquesthub`. The existing Cloudflare Pages GitHub integration will rebuild using `npm run build:static` and `dist/public`.
4. Test `https://tbquesthub.pages.dev/api/trpc/competitions.list` and Academic Division login, upload and removal.

**Limits:** For a no-credit-card setup, flyer images are stored as base64 in D1 and must be <= 700 KB. Compress large flyers before uploading. D1 has free-tier quotas and this is suitable for a small student competition board, not unlimited image hosting. Password login uses a 15-minute cooldown after a failed attempt. The API includes updateCompetition, but the current interface still needs an Edit button; Add/Delete/Login are already wired to this API. No existing Manus data is migrated. Do not share the password.
