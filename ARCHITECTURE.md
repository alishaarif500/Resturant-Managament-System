# Architecture

```
Browser (SPA, hash routing)            Node.js process
 public/js/app.js  router + shell  ->   server/index.js   static files + security headers
 public/js/site.js customer pages       server/lib/router.js  JSON router, auth levels, error mapping
 public/js/admin.js admin pages         server/routes/*.js    thin HTTP handlers + validation
 public/js/lib.js  api client, cart     server/services/*.js  pricing, orders, reservations (business rules)
                                        server/lib/db.js      SQLite (node:sqlite), migrations, transactions
                                                        |
                                                        v
                                                  data/restaurant.db
```

## Layers
- **Routes** parse and validate input (`Validator`), enforce auth (`none | optional | user | admin`) and call services. They never trust browser-calculated values.
- **Services** hold the rules: `pricing.quote` prices a cart from current database rows; `orders.createOrder` runs in one transaction and snapshots names/prices into `order_items`; `orders.changeStatus` enforces the legal status graph; `reservations` finds a free table and prevents overlaps.
- **Database**: plain SQL, `PRAGMA foreign_keys=ON`, WAL, versioned `.sql` migrations tracked in `schema_migrations`. Money is stored as integer cents.
- **Frontend**: ES modules, an escaping `html` tagged template (all interpolations are escaped), event delegation via `data-action`, no inline scripts/styles (strict CSP), generated placeholder images with a fallback so images never appear broken.

## Data model (tables)
`users` (role: customer/admin) · `sessions` (hashed tokens) · `categories` · `food_items` · `food_variations` · `food_extras` · `dining_tables` · `reservations` · `discount_codes` · `orders` · `order_items` (snapshot) · `order_events` (status history) · `contact_messages` · `promotions` · `testimonials` · `settings` (key/value). Unique constraints, foreign keys (RESTRICT/CASCADE/SET NULL chosen per relation), CHECK constraints for statuses and quantities, and indexes on status, dates, foreign keys and menu flags.

## Order status graph
`pending → confirmed → preparing → (ready | out_for_delivery) → delivered`; any non-terminal state → `cancelled`. Pickup uses `ready`, delivery uses `out_for_delivery`.

## Migrating to the recommended stack
The separation maps directly: `server/routes` → Express routers (or Next.js route handlers), `server/services` → service modules unchanged except for the DB calls, `migrations/001_init.sql` → Prisma schema/migrations for PostgreSQL (the tables and constraints are portable; replace `datetime('now')` defaults with `now()` and `INTEGER PRIMARY KEY AUTOINCREMENT` with serial/identity columns), `public/js/*.js` pages → React components. Tests in `tests/api.test.js` exercise the HTTP API only, so they can be reused as a regression suite for the port.
