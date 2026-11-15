# Deployment

Requirements: a Linux/Windows/macOS server with **Node.js 22.13+**. There is nothing to build.

1. Copy the project, then `cp .env.example .env` and set `NODE_ENV=production`, `PORT`, `ADMIN_EMAIL`, a strong `ADMIN_PASSWORD`.
2. `npm run seed` once (creates the admin; optionally delete the demo categories/dishes in the admin afterwards).
3. Run behind a reverse proxy that terminates **HTTPS** (Nginx/Caddy). Production mode sets Secure cookies and HSTS, so HTTPS is required for sign-in to work.
4. Keep it running with a service manager, e.g. systemd:

```ini
[Service]
WorkingDirectory=/srv/restaurant
EnvironmentFile=/srv/restaurant/.env
ExecStart=/usr/bin/node server/index.js
Restart=always
User=restaurant
```

5. **Back up** `data/restaurant.db` (use `sqlite3 data/restaurant.db ".backup backup.db"` or stop the service and copy the file) and the `public/uploads/` folder.
6. Update the placeholder contact details, hours, fees and content in **Admin → Website**.

Operational notes: run a single process (SQLite + in-memory rate limiting). Behind a reverse proxy set `TRUST_PROXY=true` so rate limits apply per real client instead of per proxy address - and make sure the proxy overwrites (not appends to) `X-Forwarded-For`, otherwise clients can spoof it. Online payments are not implemented.
