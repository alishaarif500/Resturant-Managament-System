# HTTP API

All responses are JSON: `{ "ok": true, "data": ... }` or `{ "ok": false, "error": { "message": "...", "fields": { "field": "msg" } | null } }`. Mutating requests must send `Content-Type: application/json`. Auth is a `sid` HttpOnly cookie. Money values are integer cents.

## Public
| Method | Path | Notes |
|---|---|---|
| GET | `/api/health`, `/api/settings`, `/api/categories`, `/api/home` | |
| GET | `/api/foods?category=&q=&sort=&featured=1&popular=1` | sort: `popular` (default), `name`, `price_asc`, `price_desc` |
| GET | `/api/foods/:id` | includes `variations`, `extras` |
| POST | `/api/cart/quote` | `{items:[{foodId,variationId?,extraIds?,quantity,instructions?}],orderType,discountCode?}` → server-priced breakdown |
| POST | `/api/orders` | cart + `name, phone, email, orderType, address?, city?, notes?, paymentMethod:"cod"` |
| POST | `/api/orders/track` | `{orderNumber, phone}` |
| POST | `/api/reservations`, `/api/reservations/lookup` | create / `{ref, phone}` |
| POST | `/api/contact` | |

## Auth and account (customer)
`POST /api/auth/register|login|logout`, `GET /api/auth/me`, `PUT /api/account/profile`, `POST /api/account/password`, `GET /api/account/orders`, `POST /api/account/orders/:id/cancel` (pending only), `GET /api/account/reservations`, `POST /api/account/reservations/:id/cancel`.

## Admin (role `admin` required, otherwise 401/403)
`GET /api/admin/stats` · `GET|POST /api/admin/categories`, `PUT|DELETE /api/admin/categories/:id` · `GET|POST /api/admin/foods`, `GET|PUT|DELETE /api/admin/foods/:id`, `PATCH /api/admin/foods/:id/flags` · `POST /api/admin/upload` (`{dataUrl}`) · `GET /api/admin/orders?status=&q=&from=&to=&page=`, `GET /api/admin/orders/:id`, `PATCH /api/admin/orders/:id/status` · `GET /api/admin/customers[?q=]`, `/:id` · `GET /api/admin/reservations?status=&date=`, `PATCH /api/admin/reservations/:id` · `GET /api/admin/reports?period=daily|weekly|monthly` · `GET|PUT /api/admin/settings` · CRUD under `/api/admin/promotions|testimonials|discounts|tables` · `GET /api/admin/messages`, `PATCH|DELETE /api/admin/messages/:id`.

Status codes: 400 bad JSON, 401 not signed in, 403 forbidden, 404, 409 conflict (duplicate, in use, illegal transition, no table), 413 too large, 415 wrong content type, 422 validation, 429 rate limited.
