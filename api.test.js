'use strict';
// Integration tests: boots the real server on a random port with a temporary database.
// Run with: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../server/index');
const { seedDemo, ensureAdmin } = require('../scripts/seed');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rms-test-'));
let app; let base;

function client() {
  let cookie = '';
  const call = async (method, url, body, extraHeaders = {}) => {
    const headers = { ...extraHeaders };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (cookie) headers.Cookie = cookie;
    const res = await fetch(base + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0].endsWith('=') ? '' : set.split(';')[0];
    let json = null; const text = await res.text();
    try { json = JSON.parse(text); } catch { /* static file */ }
    return { status: res.status, json, data: json && json.data, error: json && json.error, text, headers: res.headers };
  };
  return { get: (u) => call('GET', u), post: (u, b = {}) => call('POST', u, b), put: (u, b = {}) => call('PUT', u, b), patch: (u, b = {}) => call('PATCH', u, b), del: (u) => call('DELETE', u), call };
}

const anon = () => client();
let admin; let alice; let bob;
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const orderBody = (over = {}) => ({
  name: 'Guest Person', phone: '+1 555 123 4567', email: 'guest@example.com', orderType: 'pickup', paymentMethod: 'cod',
  items: [{ foodId: 1, quantity: 1 }], ...over,
});

test.before(async () => {
  app = createApp({ dbPath: path.join(tmp, 'test.db'), uploadDir: path.join(tmp, 'uploads'), port: 0 });
  seedDemo(app.db);
  ensureAdmin(app.db, 'admin@test.local', 'AdminPass123');
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${app.server.address().port}`;
  admin = client();
  const r = await admin.post('/api/auth/login', { email: 'admin@test.local', password: 'AdminPass123' });
  assert.equal(r.status, 200);
});
test.after(async () => { await app.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

// ---------------------------------------------------------------- public menu
test('health and settings endpoints respond', async () => {
  const c = anon();
  assert.equal((await c.get('/api/health')).data.status, 'ok');
  assert.ok((await c.get('/api/settings')).data.restaurant_name);
});

test('menu: lists items, filters by category, searches, sorts', async () => {
  const c = anon();
  const all = (await c.get('/api/foods')).data;
  assert.ok(all.length >= 16);
  const pizza = (await c.get('/api/foods?category=pizza')).data;
  assert.ok(pizza.length === 2 && pizza.every((f) => f.category_slug === 'pizza'));
  const found = (await c.get('/api/foods?q=biryani')).data;
  assert.ok(found.some((f) => f.name === 'Chicken Biryani'));
  const asc = (await c.get('/api/foods?sort=price_asc')).data.map((f) => f.price_cents);
  assert.deepEqual(asc, [...asc].sort((a, b) => a - b));
  const desc = (await c.get('/api/foods?sort=price_desc')).data.map((f) => f.price_cents);
  assert.deepEqual(desc, [...desc].sort((a, b) => b - a));
});

test('menu: hostile search strings are treated as plain text', async () => {
  const c = anon();
  for (const q of ["' OR 1=1 --", '%', '_', '"; DROP TABLE orders; --']) {
    const r = await c.get('/api/foods?q=' + encodeURIComponent(q));
    assert.equal(r.status, 200);
    assert.equal(r.data.length, 0);
  }
  assert.ok((await c.get('/api/foods')).data.length >= 16, 'table must still exist');
});

test('food detail returns variations and extras; unknown id is 404', async () => {
  const c = anon();
  const pizza = (await c.get('/api/foods?category=pizza')).data[0];
  const d = (await c.get('/api/foods/' + pizza.id)).data;
  assert.equal(d.variations.length, 3);
  assert.ok(d.extras.length >= 1);
  assert.equal((await c.get('/api/foods/99999')).status, 404);
  assert.equal((await c.get('/api/nope')).status, 404);
});

test('home endpoint returns featured items, categories, promotions', async () => {
  const h = (await anon().get('/api/home')).data;
  assert.ok(h.featured.length > 0 && h.categories.length === 8 && h.promotions.length >= 1);
});

// ---------------------------------------------------------------- auth
test('register validates input and rejects weak passwords', async () => {
  const c = anon();
  const bad = await c.post('/api/auth/register', { name: 'A', email: 'nope', phone: '1', password: 'short' });
  assert.equal(bad.status, 422);
  assert.ok(bad.error.fields.email && bad.error.fields.name && bad.error.fields.phone);
  const weak = await c.post('/api/auth/register', { name: 'Alice Test', email: 'alice@test.local', phone: '+1 555 000 1111', password: 'onlyletters' });
  assert.equal(weak.status, 422);
  assert.ok(weak.error.fields.password);
});

test('register, duplicate email, role escalation is ignored, passwords are hashed', async () => {
  alice = client();
  const r = await alice.post('/api/auth/register', { name: 'Alice Test', email: 'Alice@Test.local', phone: '+1 555 000 1111', password: 'Passw0rd123' });
  assert.equal(r.status, 201);
  assert.equal(r.data.user.role, 'customer');
  assert.equal((await anon().post('/api/auth/register', { name: 'Alice Two', email: 'alice@test.local', phone: '+1 555 000 1111', password: 'Passw0rd123' })).status, 409);
  const sneaky = client();
  const s = await sneaky.post('/api/auth/register', { name: 'Mallory X', email: 'mallory@test.local', phone: '+1 555 000 2222', password: 'Passw0rd123', role: 'admin' });
  assert.equal(s.data.user.role, 'customer');
  assert.equal((await sneaky.get('/api/admin/stats')).status, 403);
  const row = app.db.prepare("SELECT password_hash FROM users WHERE email = 'alice@test.local'").get();
  assert.ok(row.password_hash.startsWith('scrypt$') && !row.password_hash.includes('Passw0rd123'));
});

test('login: wrong password, success, session cookie flags, me, logout', async () => {
  const c = anon();
  assert.equal((await c.post('/api/auth/login', { email: 'alice@test.local', password: 'wrong' })).status, 401);
  const ok = await c.post('/api/auth/login', { email: 'alice@test.local', password: 'Passw0rd123' });
  assert.equal(ok.status, 200);
  const cookie = ok.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Lax/);
  assert.equal((await c.get('/api/auth/me')).data.user.email, 'alice@test.local');
  await c.post('/api/auth/logout');
  assert.equal((await c.get('/api/auth/me')).data.user, null);
});

test('login is rate limited after repeated failures', async () => {
  const c = anon(); let last;
  for (let i = 0; i < 10; i++) last = await c.post('/api/auth/login', { email: 'ratelimit@test.local', password: 'bad' + i });
  assert.equal(last.status, 429);
});

test('unauthenticated users cannot use protected endpoints; customers cannot reach admin', async () => {
  assert.equal((await anon().get('/api/account/orders')).status, 401);
  assert.equal((await anon().get('/api/admin/stats')).status, 401);
  assert.equal((await alice.get('/api/admin/stats')).status, 403);
  assert.equal((await alice.get('/api/admin/orders')).status, 403);
  assert.equal((await alice.post('/api/admin/foods', {})).status, 403);
  assert.equal((await alice.del('/api/admin/foods/1')).status, 403);
  assert.equal((await alice.put('/api/admin/settings', { restaurant_name: 'Hacked' })).status, 403);
});

test('rate limiting keys on X-Forwarded-For only when TRUST_PROXY is enabled', async () => {
  // Disabled (default): the header is ignored, so spoofing it cannot reset a limit.
  const c = anon(); let last;
  for (let i = 0; i < 10; i++) last = await c.call('POST', '/api/auth/login', { email: 'spoof@test.local', password: 'bad' + i }, { 'X-Forwarded-For': '9.9.9.' + i });
  assert.equal(last.status, 429);
  assert.equal(require('../server/lib/router').Router.prototype.clientIp.call({ cfg: { trustProxy: true } }, { headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }, socket: { remoteAddress: '::1' } }), '1.2.3.4');
  assert.equal(require('../server/lib/router').Router.prototype.clientIp.call({ cfg: { trustProxy: false } }, { headers: { 'x-forwarded-for': '1.2.3.4' }, socket: { remoteAddress: '::1' } }), '::1');
});

test('JSON content-type is required for mutating requests', async () => {
  const res = await fetch(base + '/api/contact', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' });
  assert.equal(res.status, 415);
  const bad = await fetch(base + '/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{oops' });
  assert.equal(bad.status, 400);
});

test('profile update and password change', async () => {
  const c = client();
  await c.post('/api/auth/register', { name: 'Pat Change', email: 'pat@test.local', phone: '+1 555 000 3333', password: 'Passw0rd123' });
  assert.equal((await c.put('/api/account/profile', { name: 'Pat Updated', phone: '+1 555 000 4444' })).data.user.name, 'Pat Updated');
  assert.equal((await c.post('/api/account/password', { current: 'wrong', password: 'NewPassw0rd1' })).status, 403);
  assert.equal((await c.post('/api/account/password', { current: 'Passw0rd123', password: 'NewPassw0rd1' })).status, 200);
  assert.equal((await anon().post('/api/auth/login', { email: 'pat@test.local', password: 'NewPassw0rd1' })).status, 200);
});

// ---------------------------------------------------------------- pricing & orders
test('quote: server computes totals; client-sent prices are ignored', async () => {
  const c = anon();
  const burger = (await c.get('/api/foods?q=Classic Beef')).data[0]; // 8.99
  const q = await c.post('/api/cart/quote', { orderType: 'delivery', items: [{ foodId: burger.id, quantity: 2, price: 1, unitCents: 1, totalCents: 1 }] });
  assert.equal(q.status, 200);
  assert.equal(q.data.subtotal, 1798);
  assert.equal(q.data.delivery, 300);
  assert.equal(q.data.total, 2098);
});

test('quote: variations, extras, free delivery threshold, pickup has no delivery fee', async () => {
  const c = anon();
  const pizza = (await c.get('/api/foods/' + (await c.get('/api/foods?q=Margherita')).data[0].id)).data;
  const large = pizza.variations.find((v) => v.name === 'Large');
  const cheese = pizza.extras.find((e) => e.name === 'Extra cheese');
  const q = (await c.post('/api/cart/quote', { orderType: 'delivery', items: [{ foodId: pizza.id, variationId: large.id, extraIds: [cheese.id], quantity: 2 }] })).data;
  assert.equal(large.price_delta_cents, 700);
  assert.equal(q.lines[0].unitCents, 1099 + 700 + 150);
  assert.equal(q.subtotal, (1099 + 700 + 150) * 2);
  assert.equal(q.delivery, 0, 'free delivery over 30.00');
  const p = (await c.post('/api/cart/quote', { orderType: 'pickup', items: [{ foodId: pizza.id, quantity: 1 }] })).data;
  assert.equal(p.delivery, 0);
  assert.equal(p.lines[0].variationName, 'Small', 'first option is the default');
});

test('quote: discount codes (valid, invalid, below minimum)', async () => {
  const c = anon();
  const items = [{ foodId: 1, quantity: 2 }]; // 17.98
  const ok = (await c.post('/api/cart/quote', { orderType: 'pickup', items, discountCode: 'welcome10' })).data;
  assert.equal(ok.discount, 179); assert.equal(ok.total, 1798 - 179);
  assert.ok((await c.post('/api/cart/quote', { orderType: 'pickup', items, discountCode: 'NOPE' })).data.discountError);
  const low = (await c.post('/api/cart/quote', { orderType: 'pickup', items: [{ foodId: 15, quantity: 1 }], discountCode: 'WELCOME10' })).data;
  assert.ok(low.discountError && low.discount === 0);
});

test('quote rejects bad carts', async () => {
  const c = anon();
  for (const items of [[], 'x', [{ foodId: 1, quantity: 0 }], [{ foodId: 1, quantity: 51 }], [{ foodId: 1, quantity: -3 }], [{ foodId: 1, quantity: 1.5 }], [{ foodId: 99999, quantity: 1 }], [{ foodId: 1, variationId: 999, quantity: 1 }], [{ foodId: 1, extraIds: [999], quantity: 1 }]]) {
    const r = await c.post('/api/cart/quote', { orderType: 'pickup', items });
    assert.ok([409, 422].includes(r.status), JSON.stringify(items) + ' -> ' + r.status);
  }
});

test('order: guest pickup order is stored with server-calculated totals', async () => {
  const c = anon();
  const r = await c.post('/api/orders', orderBody({ items: [{ foodId: 1, quantity: 2, price: 0.01, total: 1 }], totalCents: 1, unit_price_cents: 1 }));
  assert.equal(r.status, 201);
  assert.match(r.data.order_number, /^ORD-\d{6}-[0-9A-F]{5}$/);
  assert.equal(r.data.subtotal_cents, 1798); assert.equal(r.data.total_cents, 1798); assert.equal(r.data.status, 'pending');
  assert.equal(r.data.events.length, 1);
});

test('order: delivery requires address and city; online payment is refused; min order enforced', async () => {
  const c = anon();
  const d = await c.post('/api/orders', orderBody({ orderType: 'delivery' }));
  assert.equal(d.status, 422); assert.ok(d.error.fields.address && d.error.fields.city);
  const online = await c.post('/api/orders', orderBody({ paymentMethod: 'online' }));
  assert.equal(online.status, 422);
  app.db.prepare("UPDATE settings SET value='5000' WHERE key='min_order_cents'").run();
  assert.equal((await c.post('/api/orders', orderBody())).status, 422);
  app.db.prepare("UPDATE settings SET value='0' WHERE key='min_order_cents'").run();
});

test('order: delivery order with address, discount and fee', async () => {
  const c = anon();
  const r = await c.post('/api/orders', orderBody({ orderType: 'delivery', address: '1 Test Street', city: 'Testville', notes: 'Ring twice', items: [{ foodId: 1, quantity: 2 }], discountCode: 'WELCOME10' }));
  assert.equal(r.status, 201);
  assert.equal(r.data.discount_cents, 179); assert.equal(r.data.delivery_cents, 300); assert.equal(r.data.total_cents, 1798 - 179 + 300);
  assert.equal(r.data.address, '1 Test Street');
  const bad = await c.post('/api/orders', orderBody({ discountCode: 'BOGUS' }));
  assert.equal(bad.status, 422);
});

test('order: invalid customer fields and unavailable items are rejected, nothing is saved', async () => {
  const c = anon();
  const before = app.db.prepare('SELECT COUNT(*) n FROM orders').get().n;
  assert.equal((await c.post('/api/orders', orderBody({ name: '', email: 'bad', phone: 'abc' }))).status, 422);
  assert.equal((await c.post('/api/orders', orderBody({ items: [] }))).status, 422);
  await admin.patch('/api/admin/foods/2/flags', { available: false });
  const un = await c.post('/api/orders', orderBody({ items: [{ foodId: 1, quantity: 1 }, { foodId: 2, quantity: 1 }] }));
  assert.equal(un.status, 409);
  await admin.patch('/api/admin/foods/2/flags', { available: true });
  assert.equal(app.db.prepare('SELECT COUNT(*) n FROM orders').get().n, before);
});

test('order history keeps purchased names and prices after the menu changes or item is deleted', async () => {
  const f = (await admin.post('/api/admin/foods', { category_id: 1, name: 'Temp Special', description: 'x', price_cents: 1000 })).data;
  const o = (await anon().post('/api/orders', orderBody({ items: [{ foodId: f.id, quantity: 2 }] }))).data;
  await admin.put('/api/admin/foods/' + f.id, { category_id: 1, name: 'Renamed', description: 'x', price_cents: 5000 });
  let d = (await admin.get('/api/admin/orders/' + o.id)).data;
  assert.equal(d.items[0].name, 'Temp Special'); assert.equal(d.items[0].unit_price_cents, 1000); assert.equal(d.total_cents, 2000);
  assert.equal((await admin.del('/api/admin/foods/' + f.id)).status, 200);
  d = (await admin.get('/api/admin/orders/' + o.id)).data;
  assert.equal(d.items[0].name, 'Temp Special'); assert.equal(d.items[0].food_id, null);
});

test('tracking requires the order number AND matching phone', async () => {
  const c = anon();
  const o = (await c.post('/api/orders', orderBody({ phone: '+92 300 1234567' }))).data;
  const ok = await c.post('/api/orders/track', { orderNumber: o.order_number.toLowerCase(), phone: '0092-300-1234567'.replace('0092', '+92') });
  assert.equal(ok.status, 200); assert.equal(ok.data.order_number, o.order_number);
  assert.equal(ok.data.user_id, undefined);
  assert.equal((await c.post('/api/orders/track', { orderNumber: o.order_number, phone: '+92 300 0000000' })).status, 404);
  assert.equal((await c.post('/api/orders/track', { orderNumber: 'ORD-000000-XXXXX', phone: '+92 300 1234567' })).status, 404);
  assert.equal((await c.post('/api/orders/track', { orderNumber: '', phone: '' })).status, 422);
});

test('customers see only their own orders and cannot cancel others', async () => {
  bob = client();
  await bob.post('/api/auth/register', { name: 'Bob Tester', email: 'bob@test.local', phone: '+1 555 000 9999', password: 'Passw0rd123' });
  const a = (await alice.post('/api/orders', orderBody({ name: 'Alice Test' }))).data;
  const b = (await bob.post('/api/orders', orderBody({ name: 'Bob Tester' }))).data;
  const aliceOrders = (await alice.get('/api/account/orders')).data.map((x) => x.order_number);
  assert.ok(aliceOrders.includes(a.order_number) && !aliceOrders.includes(b.order_number));
  assert.equal((await alice.post(`/api/account/orders/${b.id}/cancel`)).status, 404);
  assert.equal((await alice.post(`/api/account/orders/${a.id}/cancel`)).data.status, 'cancelled');
  assert.equal((await alice.post(`/api/account/orders/${a.id}/cancel`)).status, 409, 'cannot cancel twice');
});

// ---------------------------------------------------------------- admin order workflow
test('admin order status workflow (delivery) follows valid transitions only', async () => {
  const o = (await anon().post('/api/orders', orderBody({ orderType: 'delivery', address: '2 Road', city: 'Town', items: [{ foodId: 3, quantity: 1 }] }))).data;
  const set = (s) => admin.patch(`/api/admin/orders/${o.id}/status`, { status: s });
  assert.equal((await set('delivered')).status, 409, 'cannot skip steps');
  assert.equal((await set('ready')).status, 409, 'delivery orders do not use ready');
  assert.equal((await set('confirmed')).data.status, 'confirmed');
  assert.equal((await set('preparing')).data.status, 'preparing');
  assert.equal((await set('out_for_delivery')).data.status, 'out_for_delivery');
  const done = await set('delivered');
  assert.equal(done.data.status, 'delivered'); assert.equal(done.data.events.length, 5);
  assert.equal((await set('cancelled')).status, 409, 'terminal');
  assert.equal((await set('bogus')).status, 422);
});

test('admin: pickup flow uses ready; reject (cancel) stores a reason', async () => {
  const o = (await anon().post('/api/orders', orderBody({ items: [{ foodId: 3, quantity: 1 }] }))).data;
  for (const s of ['confirmed', 'preparing', 'ready', 'delivered']) assert.equal((await admin.patch(`/api/admin/orders/${o.id}/status`, { status: s })).data.status, s);
  const o2 = (await anon().post('/api/orders', orderBody())).data;
  const rej = await admin.patch(`/api/admin/orders/${o2.id}/status`, { status: 'cancelled', reason: 'Out of stock' });
  assert.equal(rej.data.status, 'cancelled'); assert.equal(rej.data.cancel_reason, 'Out of stock');
});

test('admin order list: filter by status, search, pagination shape', async () => {
  const all = (await admin.get('/api/admin/orders')).data;
  assert.ok(all.total >= 8 && all.pages >= 1);
  const del = (await admin.get('/api/admin/orders?status=delivered')).data;
  assert.ok(del.orders.length >= 2 && del.orders.every((x) => x.status === 'delivered'));
  const s = (await admin.get('/api/admin/orders?q=' + encodeURIComponent('Bob Tester'))).data;
  assert.ok(s.orders.length === 1 && s.orders[0].customer_name === 'Bob Tester');
  const future = (await admin.get('/api/admin/orders?from=2999-01-01')).data;
  assert.equal(future.total, 0);
});

// ---------------------------------------------------------------- reservations
const resBody = (over = {}) => ({ name: 'Rita Guest', phone: '+1 555 777 8888', email: 'rita@example.com', date: tomorrow, time: '19:00', guests: 2, requests: '', ...over });

test('reservation: validation (past date, outside hours, bad guests)', async () => {
  const c = anon();
  assert.equal((await c.post('/api/reservations', resBody({ date: '2020-01-01' }))).status, 422);
  assert.equal((await c.post('/api/reservations', resBody({ time: '03:00' }))).status, 422);
  assert.equal((await c.post('/api/reservations', resBody({ guests: 0 }))).status, 422);
  assert.equal((await c.post('/api/reservations', resBody({ guests: 'x' }))).status, 422);
  assert.equal((await c.post('/api/reservations', resBody({ date: '2030-02-31' }))).status, 422);
  assert.equal((await c.post('/api/reservations', resBody({ guests: 9 }))).status, 409, 'no table seats 9');
});

test('reservation: created as pending (not confirmed) and conflicts are prevented', async () => {
  const c = anon();
  const r = await c.post('/api/reservations', resBody({ guests: 8, time: '20:00' }));
  assert.equal(r.status, 201); assert.equal(r.data.status, 'pending');
  // Only one table seats 8; an overlapping request must be refused, a non-overlapping one accepted.
  assert.equal((await c.post('/api/reservations', resBody({ guests: 8, time: '20:30' }))).status, 409);
  assert.equal((await c.post('/api/reservations', resBody({ guests: 8, time: '18:00' }))).status, 201);
  // Admin rejection frees the slot.
  assert.equal((await admin.patch('/api/admin/reservations/' + r.data.id, { status: 'rejected' })).data.status, 'rejected');
  assert.equal((await c.post('/api/reservations', resBody({ guests: 8, time: '20:30' }))).status, 201);
});

test('reservation: approve, reassign to a conflicting table is blocked, state machine enforced', async () => {
  const c = anon();
  const a = (await c.post('/api/reservations', resBody({ guests: 4, time: '12:00' }))).data;
  const b = (await c.post('/api/reservations', resBody({ guests: 4, time: '12:30' }))).data;
  assert.notEqual(a.table_id, b.table_id);
  assert.equal((await admin.patch('/api/admin/reservations/' + a.id, { status: 'approved' })).data.status, 'approved');
  assert.equal((await admin.patch('/api/admin/reservations/' + b.id, { table_id: a.table_id })).status, 409);
  assert.equal((await admin.patch('/api/admin/reservations/' + b.id, { table_id: 1 })).status, 409, 'table 1 seats 2, party is 4');
  assert.equal((await admin.patch('/api/admin/reservations/' + a.id, { status: 'pending' })).status, 409);
  assert.equal((await admin.patch('/api/admin/reservations/' + a.id, { status: 'completed' })).data.status, 'completed');
  assert.equal((await admin.patch('/api/admin/reservations/' + a.id, { status: 'approved' })).status, 409);
});

test('reservation: lookup needs reference + phone; customers cancel only their own', async () => {
  const mine = (await alice.post('/api/reservations', resBody({ name: 'Alice Test', phone: '+1 555 000 1111', time: '15:00' }))).data;
  const c = anon();
  assert.equal((await c.post('/api/reservations/lookup', { ref: mine.ref, phone: '+1 555 000 1111' })).data.ref, mine.ref);
  assert.equal((await c.post('/api/reservations/lookup', { ref: mine.ref, phone: '+1 555 999 0000' })).status, 404);
  assert.equal((await bob.post(`/api/account/reservations/${mine.id}/cancel`)).status, 404);
  assert.ok((await alice.get('/api/account/reservations')).data.some((x) => x.id === mine.id));
  assert.equal((await alice.post(`/api/account/reservations/${mine.id}/cancel`)).data.status, 'cancelled');
});

// ---------------------------------------------------------------- contact
test('contact form validates and stores messages; admin can read and delete', async () => {
  const c = anon();
  assert.equal((await c.post('/api/contact', { name: '', email: 'x', message: '' })).status, 422);
  const r = await c.post('/api/contact', { name: 'Sam Writer', email: 'sam@example.com', subject: 'Hello', message: 'Do you have <b>vegan</b> options?' });
  assert.equal(r.status, 201);
  const list = (await admin.get('/api/admin/messages')).data;
  assert.equal(list[0].message, 'Do you have <b>vegan</b> options?', 'stored verbatim; escaped on output by the UI');
  await admin.patch('/api/admin/messages/' + list[0].id, { is_read: true });
  assert.equal((await admin.del('/api/admin/messages/' + list[0].id)).status, 200);
});

// ---------------------------------------------------------------- admin CRUD
test('admin categories: create, duplicate, update, delete blocked while in use', async () => {
  const c = (await admin.post('/api/admin/categories', { name: 'Salads', sort_order: 9 })).data;
  assert.equal(c.slug, 'salads');
  assert.equal((await admin.post('/api/admin/categories', { name: 'salads' })).status, 409);
  assert.equal((await admin.put('/api/admin/categories/' + c.id, { name: 'Fresh Salads', active: true })).data.slug, 'fresh-salads');
  assert.equal((await admin.del('/api/admin/categories/1')).status, 409);
  assert.equal((await admin.del('/api/admin/categories/' + c.id)).status, 200);
});

test('admin foods: create with sizes and extras, validate, edit, toggle flags, hide from menu', async () => {
  assert.equal((await admin.post('/api/admin/foods', { category_id: 1, name: 'X', price_cents: -5 })).status, 422);
  assert.equal((await admin.post('/api/admin/foods', { category_id: 999, name: 'Ghost Dish', price_cents: 100 })).status, 422);
  assert.equal((await admin.post('/api/admin/foods', { category_id: 1, name: 'Ghost Dish', price_cents: 100, image_url: 'javascript:alert(1)' })).status, 422);
  const f = await admin.post('/api/admin/foods', { category_id: 1, name: 'Test Burger', description: 'desc', price_cents: 1234, featured: true, variations: [{ name: 'S', price_delta_cents: 0 }, { name: 'L', price_delta_cents: 200 }], extras: [{ name: 'Bacon', price_cents: 150 }] });
  assert.equal(f.status, 201); assert.equal(f.data.variations.length, 2);
  const upd = (await admin.put('/api/admin/foods/' + f.data.id, { category_id: 1, name: 'Test Burger 2', price_cents: 1300, available: true, variations: [], extras: [] })).data;
  assert.equal(upd.price_cents, 1300); assert.equal(upd.variations.length, 0);
  await admin.patch(`/api/admin/foods/${f.data.id}/flags`, { available: false });
  assert.ok(!(await anon().get('/api/foods')).data.some((x) => x.id === f.data.id && x.available === 1));
  assert.equal((await admin.del('/api/admin/foods/' + f.data.id)).status, 200);
  assert.equal((await anon().get('/api/foods/' + f.data.id)).status, 404);
});

test('admin upload: accepts real images, rejects disguised files and oversize', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const ok = await admin.post('/api/admin/upload', { dataUrl: 'data:image/png;base64,' + png.toString('base64') });
  assert.equal(ok.status, 201);
  const served = await fetch(base + ok.data.url);
  assert.equal(served.status, 200); assert.equal(served.headers.get('content-type'), 'image/png');
  const fake = await admin.post('/api/admin/upload', { dataUrl: 'data:image/png;base64,' + Buffer.from('<script>alert(1)</script>').toString('base64') });
  assert.equal(fake.status, 422);
  assert.equal((await admin.post('/api/admin/upload', { dataUrl: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' })).status, 422);
  const big = Buffer.concat([png, Buffer.alloc(2.5 * 1024 * 1024)]);
  assert.equal((await admin.post('/api/admin/upload', { dataUrl: 'data:image/png;base64,' + big.toString('base64') })).status, 413);
  assert.equal((await alice.post('/api/admin/upload', { dataUrl: 'data:image/png;base64,' + png.toString('base64') })).status, 403);
});

test('admin: discount codes, promotions, testimonials, tables CRUD', async () => {
  const d = await admin.post('/api/admin/discounts', { code: 'save20', percent: 20, min_subtotal_cents: 0 });
  assert.equal(d.data.code, 'SAVE20');
  assert.equal((await admin.post('/api/admin/discounts', { code: 'SAVE20', percent: 5 })).status, 409);
  assert.equal((await admin.post('/api/admin/discounts', { code: 'BAD', percent: 500 })).status, 422);
  assert.equal((await anon().post('/api/cart/quote', { orderType: 'pickup', items: [{ foodId: 1, quantity: 1 }], discountCode: 'SAVE20' })).data.discount, 179);
  await admin.put('/api/admin/discounts/' + d.data.id, { code: 'SAVE20', percent: 20, active: false });
  assert.ok((await anon().post('/api/cart/quote', { orderType: 'pickup', items: [{ foodId: 1, quantity: 1 }], discountCode: 'SAVE20' })).data.discountError);
  await admin.put('/api/admin/discounts/' + d.data.id, { code: 'SAVE20', percent: 20, active: true, expires_on: '2000-01-01' });
  assert.match((await anon().post('/api/cart/quote', { orderType: 'pickup', items: [{ foodId: 1, quantity: 1 }], discountCode: 'SAVE20' })).data.discountError, /expired/);
  const p = (await admin.post('/api/admin/promotions', { title: 'Lunch deal', description: 'x', code: '' })).data;
  assert.ok((await anon().get('/api/home')).data.promotions.some((x) => x.id === p.id));
  assert.equal((await admin.del('/api/admin/promotions/' + p.id)).status, 200);
  const t = (await admin.post('/api/admin/testimonials', { name: 'Tess', text: 'Great place', rating: 4 })).data;
  assert.equal(t.rating, 4);
  assert.equal((await admin.post('/api/admin/testimonials', { name: 'Tess', text: 'x', rating: 9 })).status, 422);
  const tb = (await admin.post('/api/admin/tables', { name: 'T99', capacity: 12 })).data;
  assert.equal((await admin.post('/api/admin/tables', { name: 't99', capacity: 2 })).status, 409);
  assert.equal((await admin.del('/api/admin/tables/' + tb.id)).status, 200);
});

test('admin settings: update website content, validate links and hours', async () => {
  assert.equal((await admin.put('/api/admin/settings', { facebook: 'javascript:alert(1)' })).status, 422);
  assert.equal((await admin.put('/api/admin/settings', { reservation_open: '9am' })).status, 422);
  assert.equal((await admin.put('/api/admin/settings', { whatsapp: '+1 555' })).status, 422);
  const s = (await admin.put('/api/admin/settings', { restaurant_name: 'Test Bistro', phone: '+1 555 010 0100', delivery_fee_cents: 500 })).data;
  assert.equal(s.restaurant_name, 'Test Bistro');
  assert.equal((await anon().get('/api/settings')).data.restaurant_name, 'Test Bistro');
  assert.equal((await anon().post('/api/cart/quote', { orderType: 'delivery', items: [{ foodId: 15, quantity: 1 }] })).data.delivery, 500);
  await admin.put('/api/admin/settings', { restaurant_name: 'Your Restaurant', delivery_fee_cents: 300 });
});

// ---------------------------------------------------------------- reports
test('dashboard stats and reports are computed from real orders', async () => {
  const st = (await admin.get('/api/admin/stats')).data;
  const total = app.db.prepare('SELECT COUNT(*) n FROM orders').get().n;
  assert.equal(st.totalOrders, total);
  assert.equal(st.pendingOrders, app.db.prepare("SELECT COUNT(*) n FROM orders WHERE status='pending'").get().n);
  assert.equal(st.completedOrders, app.db.prepare("SELECT COUNT(*) n FROM orders WHERE status='delivered'").get().n);
  const rev = app.db.prepare("SELECT COALESCE(SUM(total_cents),0) n FROM orders WHERE status != 'cancelled'").get().n;
  assert.equal(st.revenueTotal, rev);
  assert.equal(st.last7Days.length, 7);
  assert.equal(st.last7Days[6].revenue, rev, 'all test orders were created today');
  for (const period of ['daily', 'weekly', 'monthly']) {
    const r = (await admin.get('/api/admin/reports?period=' + period)).data;
    assert.equal(r.totals.revenue, rev); assert.equal(r.rows.reduce((s, x) => s + x.revenue, 0), rev);
    assert.ok(r.best.length > 0);
  }
  const best = (await admin.get('/api/admin/reports')).data.best;
  assert.ok(best.every((b, i) => i === 0 || best[i - 1].quantity >= b.quantity));
});

test('admin customers list and detail', async () => {
  const list = (await admin.get('/api/admin/customers?q=alice')).data;
  assert.equal(list.length, 1); assert.ok(list[0].order_count >= 1);
  const d = (await admin.get('/api/admin/customers/' + list[0].id)).data;
  assert.ok(d.orders.length >= 1);
  assert.equal((await admin.get('/api/admin/customers/1')).status, 404, 'admins are not listed as customers');
});

// ---------------------------------------------------------------- static / security
test('static files, SPA fallback, security headers, path traversal blocked', async () => {
  const c = anon();
  const home = await c.get('/');
  assert.equal(home.status, 200); assert.match(home.text, /<div id="app"/);
  assert.match(home.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(home.headers.get('x-content-type-options'), 'nosniff');
  assert.equal((await c.get('/css/styles.css')).status, 200);
  assert.equal((await c.get('/js/app.js')).status, 200);
  assert.equal((await c.get('/missing.png')).status, 404);
  for (const p of ['/..%2f..%2fpackage.json', '/%2e%2e/%2e%2e/server/index.js', '/uploads/..%2f..%2fpackage.json']) {
    const r = await fetch(base + p);
    assert.ok([400, 403, 404].includes(r.status) || !(await r.clone().text()).includes('"name": "restaurant-management-system"'), p);
  }
  assert.equal((await c.call('DELETE', '/index.html')).status, 405);
});

test('data persists across a server restart', async () => {
  const marker = (await anon().post('/api/orders', orderBody({ name: 'Persist Check' }))).data.order_number;
  const dbPath = app.cfg.dbPath; const uploadDir = app.cfg.uploadDir;
  await app.close();
  app = createApp({ dbPath, uploadDir, port: 0 });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${app.server.address().port}`;
  admin = client();
  await admin.post('/api/auth/login', { email: 'admin@test.local', password: 'AdminPass123' });
  const found = (await admin.get('/api/admin/orders?q=' + marker)).data;
  assert.equal(found.total, 1);
});
