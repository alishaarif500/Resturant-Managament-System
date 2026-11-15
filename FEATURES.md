# Implemented features and remaining limitations

Everything marked ✅ is covered by an automated API and/or browser test (see [TESTING.md](TESTING.md)).

## Customer website
- ✅ Home: hero, featured dishes, categories, promotions, "why choose us", reviews, opening hours, contact, footer (all content editable in Admin → Website)
- ✅ About page (story, mission, vision, values, quality)
- ✅ Menu loaded from the database; category filter, search, sort (featured/name/price), featured/popular/unavailable badges
- ✅ Dish details: sizes/options, extras, quantity, special instructions, live price estimate
- ✅ Cart: add/remove, quantity, delivery vs pickup, discount codes, **server-calculated** subtotal/delivery/discount/total, minimum order
- ✅ Checkout (delivery or pickup, cash) with field validation; unique order number; confirmation page
- ✅ Order tracking (order number + phone) with status timeline; customers can cancel *pending* orders
- ✅ Reservations: validation, hours check, per-table conflict prevention, status `pending` until an admin approves; lookup by reference + phone
- ✅ Contact form stored in the database; WhatsApp/social/map links appear once configured
- ✅ Accounts: register, login/logout, profile, password change, current orders, order history, reservation history

## Admin dashboard
- ✅ Statistics from real data + 7-day revenue chart
- ✅ Food CRUD, image upload, sizes/extras, availability/featured/popular
- ✅ Category management (cannot delete a category that still has items)
- ✅ Orders: search, status and date filters, pagination, detail, accept/reject with reason, enforced status workflow, history
- ✅ Customers: list, search, detail with orders and reservations
- ✅ Reservations: approve / reject / complete / cancel, table reassignment with conflict checks
- ✅ Reports: daily / weekly / monthly revenue and order counts, best sellers, orders by status
- ✅ Messages, website content, delivery fee, free-delivery threshold, minimum order, reservation hours/length, discount codes, promotions, reviews, tables

## Design rules enforced by the code
- Orders store a snapshot of item names and prices; later menu edits or deletions never change history.
- Revenue = orders whose status is not `cancelled`; "delivered revenue" is shown separately.
- Reservation availability: a table is free for a slot if no pending/approved reservation on that table starts within the configured reservation length (default 90 min).

## Not implemented / limitations
- Online payment (not simulated; the option is displayed as "coming soon" and the API rejects it)
- Email/SMS/WhatsApp notifications, password reset, email verification
- Server-side cart (stored in the browser's localStorage)
- Multi-branch, staff roles beyond customer/admin, inventory/stock counts, refunds
- Real food photography (placeholders are generated; upload your own)
- Internationalisation; the currency symbol is configurable but amounts use two decimals
- Tailwind CSS, React/Next.js, Express, Prisma and PostgreSQL from the original brief are **not** used (see README)
- Horizontal scaling: SQLite and the in-memory rate limiter assume one server process
