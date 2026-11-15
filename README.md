# Restaurant Management System

A full-stack web application for a restaurant: customers browse a dynamic menu, build a cart, order for delivery or pickup, track orders, reserve tables and manage an account; restaurant staff run everything from a secured admin dashboard (menu, orders, reservations, customers, reports, website content).

**Stack:** Node.js (built-in `http`) · SQLite (built-in `node:sqlite`) · vanilla JavaScript single-page app · hand-written responsive CSS · **zero npm runtime dependencies**.

![Home page](docs/screenshots/home-desktop.png)

| Menu (mobile) | Admin dashboard |
|---|---|
| ![Menu on mobile](docs/screenshots/menu-mobile.png) | ![Admin dashboard](docs/screenshots/admin-dashboard.png) |

> **Demo data notice:** the restaurant name, prices, dishes, discount code (`WELCOME10`), tables and the sample review are *placeholders* created by `npm run seed`. Contact details are obvious placeholders. Replace everything from **Admin → Website / Food Items**. No real business information is bundled, and there is **no stock photography** — dishes show generated placeholder artwork until you upload real photos in the admin dashboard.

## Why not React / Express / Prisma / PostgreSQL?

The brief recommended those technologies. This project was built and verified in an offline sandbox where `npm install` and a database server were unavailable, so it uses only what ships with Node.js 22 (`http`, `crypto`, `node:sqlite`) and browser-native ES modules. The benefit is that every feature below was actually executed and tested end-to-end. The cost is that it deviates from the suggested stack (see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#migrating-to-the-recommended-stack) for how the layers map onto Express/Prisma/PostgreSQL if you want to migrate). `node:sqlite` is marked *experimental* by Node.js.

## Requirements

- **Node.js 22.13 or newer** (`node -v`). No other software is needed to run the app.
- For the optional browser tests only: `npm install` (installs Playwright) and `npx playwright install chromium`.

## Quick start

```bash
git clone <your-repo-url> restaurant-management-system
cd restaurant-management-system
cp .env.example .env          # Windows: copy .env.example .env
# edit .env: set ADMIN_EMAIL and (recommended) ADMIN_PASSWORD
npm run seed                  # creates the database, demo menu and the first admin account
npm start                     # http://localhost:3000
```

- Customer site: `http://localhost:3000`
- Admin dashboard: sign in with the admin email/password at `#/login`, you are taken to `#/admin`.
- If `ADMIN_PASSWORD` is empty, `npm run seed` generates a random one and prints it **once**. Admin accounts can only be created by the seed script; the public registration form always creates customers.
- The database file is created automatically in `data/` and migrations in `server/migrations/` run on every start.
- Seeding is safe to repeat: it never overwrites an existing menu.

## Features

**Customers:** home page with featured dishes, categories, offers, reviews, hours and contact info · About page · dynamic menu with category filter, search, sorting, featured/popular badges, availability · dish details with sizes, extras, quantity and instructions · cart (persisted in the browser) with server-calculated totals, delivery fee and discount codes · checkout for delivery or pickup (cash payment) · order confirmation and order tracking with status timeline (order number + phone) · table reservations with availability and conflict checks · contact form · registration, login, profile, order history, current orders, reservation history, password change.

**Admin:** dashboard with real statistics and a revenue chart · food CRUD with image upload, sizes/options, extras, availability/featured/popular toggles · categories · orders (search, status/date filters, detail, accept/reject, status workflow, history) · customers and their history · reservations (approve/reject/complete/cancel, table assignment) · daily/weekly/monthly sales, best sellers · contact messages · website content, opening hours, fees, discount codes, promotions, reviews and dining tables.

Details and limitations: [docs/FEATURES.md](docs/FEATURES.md).

## Project structure

```
server/
  index.js            HTTP server, security headers, static files
  config.js           environment configuration (.env loader)
  lib/                db (SQLite + migrations), router, auth, validation, http helpers
  routes/             public.js, account.js (auth + customer), admin.js
  services/           pricing.js, orders.js, reservations.js  (business rules)
  migrations/         001_init.sql (schema, indexes, default settings)
public/               single-page app: index.html, css/styles.css, js/{app,site,admin,lib}.js
scripts/seed.js       demo data + first admin
tests/                api.test.js (node:test), e2e.js (Playwright)
docs/                 ARCHITECTURE, API, TESTING, DEPLOYMENT, FEATURES, screenshots
```

## Configuration (`.env`)

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `NODE_ENV` | `development` | `production` enables Secure cookies and HSTS |
| `DB_PATH` | `./data/restaurant.db` | SQLite file |
| `UPLOAD_DIR` | `./public/uploads` | Uploaded food images |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | – | Used only by `npm run seed` |
| `COOKIE_SECURE` | `false` | Force the Secure flag on the session cookie |
| `TRUST_PROXY` | `false` | `true` only behind your own reverse proxy: rate limits use `X-Forwarded-For` |

## Testing

```bash
npm test                                  # 41 API/integration tests, no extra install
npm install && npx playwright install chromium
npm run test:e2e                          # 39 browser tests (Chromium); SHOTS_DIR=docs/screenshots to save screenshots
```

Results of the last run and what was *not* tested: [docs/TESTING.md](docs/TESTING.md).

## Security summary

scrypt password hashing · random session tokens stored hashed, HttpOnly + SameSite=Lax cookie · server-side role checks on every admin route · JSON-only mutations (CSRF defence) · strict Content-Security-Policy (no inline scripts/styles) · all output HTML-escaped · parameterised SQL everywhere · prices and totals always recalculated on the server · upload validation by magic bytes (PNG/JPEG/GIF/WebP only, 2 MB) · login, order, tracking, contact rate limiting · order tracking requires order number **and** phone. This is not a substitute for a professional security review before real-world use.

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) (reverse proxy with HTTPS, systemd, backups).

## Limitations (honest list)

No online payment (cash only; the option is shown disabled) · no email/SMS notifications · no password-reset flow · cart lives in browser storage, not the database · single-process in-memory rate limiter · SQLite (single server, back it up) · dates for "today" and reports use server time (UTC) · automated browser tests ran on Chromium at emulated widths only (not real phones, Firefox or Safari) · no load testing · see [docs/FEATURES.md](docs/FEATURES.md).

## License

MIT, see [LICENSE](LICENSE). Replace `[Your Name]` with the copyright holder.
