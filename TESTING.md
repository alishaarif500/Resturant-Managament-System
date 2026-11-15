# Testing and verification report

All numbers below come from real runs in the development sandbox. Nothing here is estimated.

## Environment

| Item | Value |
|---|---|
| OS | Linux 6.18 (sandbox) |
| Node.js | v22.23.4 |
| SQLite (via `node:sqlite`) | 3.53.4 |
| Browser tests | Playwright 1.63.0 with Chromium 153 (headless) |
| npm runtime dependencies | none |

## Commands

```bash
npm test            # API / integration tests (node:test), temporary database per run
npm run test:e2e    # browser tests; needs: npm install && npx playwright install chromium
```

## Results of the final run

| Suite | Passed | Failed |
|---|---|---|
| `tests/api.test.js` (41 tests, real server + temp SQLite) | **41** | **0** |
| `tests/e2e.js` (39 browser tests; run twice in a row) | **39** (both runs) | **0** |

Both suites use temporary databases and upload folders, so your real data is never touched.

### What the API tests cover
- Menu: listing, category filter, search, sort, hostile search strings (`' OR 1=1 --`, `%`, `_`), 404s
- Auth: validation, weak passwords, duplicate email (case-insensitive), role-escalation attempt (`role: "admin"` ignored), hashed passwords, cookie flags, logout, login rate limit, content-type enforcement
- Authorization: anonymous → 401, customer → 403 on every admin area tried, customers only see/cancel their own orders and reservations
- Pricing: client-sent prices/totals are ignored, sizes and extras, free-delivery threshold, pickup has no fee, discount codes (valid, invalid, below minimum, inactive, expired), invalid carts (empty, 0, 51, negative, fractional quantity, unknown item/option/extra)
- Orders: guest and logged-in, delivery requires address/city, online payment refused, minimum order, unavailable items rejected with nothing saved, history keeps name/price after the menu item is edited **and** deleted, unique order numbers
- Tracking: needs order number **and** matching phone (formatting-insensitive)
- Admin workflow: only legal status transitions (pickup vs delivery flows), terminal states, rejection reason, filters/search/pagination
- Reservations: past date, outside hours, impossible date, bad guest count, no table large enough, overlapping request refused, rejection frees the slot, admin cannot move a booking onto a conflicting/too-small table, state machine, lookup needs ref + phone
- Admin CRUD: categories (duplicate, in-use delete blocked), foods (validation, `javascript:` image URL rejected, variations/extras), discounts, promotions, reviews, tables, settings validation, messages
- Upload: real PNG accepted and served with correct type; HTML disguised as PNG, SVG and >2 MB rejected; non-admin refused
- Reports/stats equal values recomputed directly from the database; persistence across a server restart; static files, SPA fallback, CSP headers, path-traversal attempts

### What the browser tests cover
Guest journey (home → menu filter/search/sort → add to cart → dish options → cart discount → checkout validation → order → tracking → reservation with conflict → contact), customer journey (register with validation, signed-in order, cancel, profile, password error, reservation cancel, sign out, blocked from admin), admin journey (login failure/success, dashboard numbers equal the database, accept → preparing → ready → delivered, guest tracking reflects it, reject with reason, filters, add/edit/disable/delete food with a real image upload, category rules, reservation approve/cancel, customers, reports, message escaping, website settings visible publicly, discount code created in UI and used in cart), and a layout sweep at **320, 375, 414, 768, 1024 and 1440 px** over 9 public pages, checkout, dish details, 9 admin pages and an order page: no horizontal scrolling and no broken images. The final test fails if any JavaScript error, CSP violation or failed network request was logged during the whole run.

Screenshots in `docs/screenshots/` were produced by this run (`SHOTS_DIR=docs/screenshots npm run test:e2e`).

## Production-mode check
A clean copy was installed with only the `.env` file, `npm run seed` was run, `NODE_ENV=production npm start` was started, and `/api/health` returned `ok`, the page was served with the CSP and HSTS headers, and a wrong-password login returned 401. There is no build step (no bundler), so "production build" means this clean start plus `node --check` on every file.

## NOT TESTED
- Firefox, Safari, Edge, and real phones/tablets (widths were emulated in Chromium only)
- Screen-reader testing; no automated accessibility audit (semantic HTML, labels, focus styles and ARIA live regions were implemented but not formally audited)
- Load/performance testing and concurrent heavy writes
- Behaviour behind a real HTTPS reverse proxy (Secure cookies were checked via headers only)
- Windows/macOS hosts (only Linux was available)
- `npm install` of the Playwright dev dependency from the registry (the sandbox had Playwright preinstalled)
- Security review by a third party; penetration testing

## Known limitations found during testing
- Reservation "today"/"past" checks and report days use server time (UTC), so near midnight in other time zones they can differ from local time.
- Login/order rate limiters are in memory and reset on restart.
