'use strict';
/**
 * Browser end-to-end tests (Playwright + Chromium) against a real server and a temporary database.
 * Setup:  npm install && npx playwright install chromium     Run: npm run test:e2e
 * Set SHOTS_DIR=docs/screenshots to also write screenshots.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createApp } = require('../server/index');
const { seedDemo, ensureAdmin } = require('../scripts/seed');

const results = [];
const step = async (name, fn) => {
  try { await fn(); results.push([name, true]); console.log('PASS', name); }
  catch (e) { results.push([name, false, e]); console.log('FAIL', name, '\n     ', String(e.message).split('\n').slice(0, 4).join('\n      ')); }
};

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rms-e2e-'));
  const app = createApp({ dbPath: path.join(tmp, 'e2e.db'), uploadDir: path.join(tmp, 'uploads'), port: 0 });
  seedDemo(app.db); ensureAdmin(app.db, 'admin@e2e.local', 'AdminPass123');
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const browser = await chromium.launch();
  const shots = process.env.SHOTS_DIR; if (shots) fs.mkdirSync(shots, { recursive: true });
  const problems = [];

  async function newPage(width = 1280, height = 900) {
    const ctx = await browser.newContext({ viewport: { width, height }, acceptDownloads: false });
    const page = await ctx.newPage();
    page.on('dialog', (d) => d.accept(d.type() === 'prompt' ? 'Out of stock' : undefined));
    page.on('console', (m) => { if (m.type() === 'error') problems.push(`console error: ${m.text()} @ ${page.url()}`); });
    page.on('pageerror', (e) => problems.push(`page error: ${e.message} @ ${page.url()} :: ${String(e.stack).split('\n').slice(1,4).join(' / ')}`));
    page.on('requestfailed', (r) => problems.push(`request failed: ${r.url()} ${r.failure() && r.failure().errorText}`));
    return page;
  }
  const ready = (page) => page.waitForFunction(() => { const m = document.getElementById('main'); return m && !m.querySelector('.loader'); });
  const go = async (page, hash) => {
    const target = `${base}/#${hash}`;
    const same = page.url() === target;
    await page.goto(target);
    if (same) await page.evaluate(() => window.dispatchEvent(new Event('hashchange'))); // same-hash revisit: force a re-render
    await page.waitForSelector('#main'); await ready(page);
  };
  const shot = async (page, name) => { if (shots) await page.screenshot({ path: path.join(shots, name + '.png') }); };
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  // ================================================================ guest customer journey (desktop)
  const guest = await newPage();
  let orderNumber = '';
  await step('home page renders hero, featured dishes, categories, hours', async () => {
    await go(guest, '/'); await guest.waitForSelector('.food-card');
    assert.ok(await guest.locator('.hero h1').isVisible());
    assert.ok((await guest.locator('.food-card').count()) >= 4);
    assert.equal(await guest.locator('.cat-card').count(), 8);
    assert.match(await guest.textContent('body'), /Opening Hours/);
    await shot(guest, 'home-desktop');
  });
  await step('menu: loads all dishes from the database, category filter, search, sort', async () => {
    await go(guest, '/menu'); await guest.waitForSelector('.food-card');
    assert.equal(await guest.locator('.food-card').count(), 16);
    await guest.click('.chip:has-text("Pizza")'); await guest.waitForFunction(() => document.querySelectorAll('.food-card').length === 2);
    await guest.click('.chip:has-text("All")'); await guest.fill('#menu-search', 'biryani');
    await guest.waitForFunction(() => document.querySelectorAll('.food-card').length === 1);
    assert.match(await guest.textContent('.food-card h3'), /Biryani/);
    await guest.fill('#menu-search', 'zzzz'); await guest.waitForSelector('.empty');
    await guest.click('.empty button'); await guest.waitForFunction(() => document.querySelectorAll('.food-card').length === 16);
    await guest.selectOption('#menu-sort', 'price_asc'); await guest.waitForTimeout(400);
    const prices = await guest.$$eval('.food-card .price', (els) => els.map((e) => Number(e.textContent.replace(/[^0-9.]/g, ''))));
    assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
    await shot(guest, 'menu-desktop');
  });
  await step('menu deep link from home category chip filters the list', async () => {
    await go(guest, '/menu?category=desserts'); await guest.waitForFunction(() => document.querySelectorAll('.food-card').length === 2);
    assert.equal(await guest.getAttribute('.chip[data-slug=desserts]', 'aria-pressed'), 'true');
  });
  await step('add to cart from a card updates the cart badge', async () => {
    await go(guest, '/menu'); await guest.waitForSelector('.food-card');
    await guest.locator('.food-card').first().locator('button:has-text("Add to Cart")').click();
    await guest.waitForFunction(() => document.querySelector('[data-cart-badge]').textContent === '1' && !document.querySelector('[data-cart-badge]').hidden);
  });
  await step('food detail: size, extras, quantity and live price, add to cart', async () => {
    await go(guest, '/menu'); await guest.click('.food-card h3 a:has-text("Margherita")'); await guest.waitForSelector('#detail-form');
    assert.equal((await guest.textContent('#d-price')).trim(), '$10.99');
    await guest.check('input[name=variation] >> nth=2'); await guest.check('input[name=extra] >> nth=0');
    assert.equal((await guest.textContent('#d-price')).trim(), '$19.49'); // 10.99 + 7.00 + 1.50
    await guest.click('[data-action=inc]'); assert.equal((await guest.textContent('#d-price')).trim(), '$38.98');
    await guest.fill('#f-instr', 'Well done please');
    await guest.click('#detail-form button[type=submit]');
    await guest.waitForFunction(() => document.querySelector('[data-cart-badge]').textContent === '3');
  });
  await step('cart: server-priced totals, quantity change, remove, discount code', async () => {
    await go(guest, '/cart'); await guest.waitForSelector('.cart-item');
    assert.equal(await guest.locator('.cart-item').count(), 2);
    assert.match(await guest.textContent('.summary .total'), /\$\d/);
    await guest.click('.cart-item:has-text("Margherita") [data-action=dec]');
    await guest.waitForFunction(() => document.querySelector('[data-cart-badge]').textContent === '2');
    await guest.click('input[name=otype][value=pickup]'); await guest.waitForFunction(() => !document.querySelector('aside .summary').textContent.includes('Delivery'));
    await guest.fill('#code', 'welcome10'); await guest.click('#code-form button'); await guest.waitForSelector('.summary .discount');
    await guest.fill('#code', 'bogus'); await guest.click('#code-form button'); await guest.waitForSelector('.field-error:not(:empty)');
    await guest.fill('#code', 'WELCOME10'); await guest.click('#code-form button'); await guest.waitForSelector('.summary .discount');
    await shot(guest, 'cart-desktop');
  });
  await step('checkout: validation errors, then successful pickup order with confirmation', async () => {
    await guest.click('a:has-text("Proceed to Checkout")'); await guest.waitForSelector('#checkout-form');
    await guest.click('#checkout-form button[type=submit]');
    await guest.waitForSelector('[data-error-for=name]:not(:empty)');
    await guest.fill('#f-name', 'Guest Tester'); await guest.fill('#f-phone', '+92 300 5551234'); await guest.fill('#f-email', 'guest@example.com');
    await guest.click('input[name=orderType][value=pickup]'); await guest.waitForFunction(() => document.getElementById('delivery-fields').hidden);
    await guest.click('#checkout-form button[type=submit]'); await guest.waitForSelector('#order-number');
    orderNumber = (await guest.textContent('#order-number')).trim();
    assert.match(orderNumber, /^ORD-\d{6}-[0-9A-F]{5}$/);
    assert.equal(await guest.evaluate(() => document.querySelector('[data-cart-badge]').hidden), true, 'cart cleared');
    const row = app.db.prepare('SELECT * FROM orders WHERE order_number = ?').get(orderNumber);
    assert.equal(row.order_type, 'pickup'); assert.equal(row.discount_code, 'WELCOME10');
    await shot(guest, 'order-confirmation');
  });
  await step('delivery checkout requires address and city', async () => {
    await go(guest, '/menu'); await guest.waitForSelector('.food-card');
    await guest.locator('.food-card').nth(2).locator('button:has-text("Add to Cart")').click();
    await go(guest, '/checkout'); await guest.click('input[name=orderType][value=delivery]'); await guest.fill('#f-name', 'Dee Livery'); await guest.fill('#f-phone', '0300 1234567'); await guest.fill('#f-email', 'dee@example.com');
    await guest.click('#checkout-form button[type=submit]');
    await guest.waitForSelector('[data-error-for=address]:not(:empty)'); await guest.waitForSelector('[data-error-for=city]:not(:empty)');
    await guest.fill('#f-address', '12 Test Road'); await guest.fill('#f-city', 'Lahore');
    await guest.click('#checkout-form button[type=submit]'); await guest.waitForSelector('#order-number');
  });
  await step('order tracking: right phone shows timeline, wrong phone is rejected', async () => {
    await go(guest, '/track'); await guest.fill('#f-orderNumber', orderNumber); await guest.fill('#f-phone', '+92 300 0000000');
    await guest.click('#track-form button[type=submit]'); await guest.waitForSelector('[data-form-error]:not(:empty)');
    await guest.fill('#f-phone', '+92 300 5551234'); await guest.click('#track-form button[type=submit]'); await guest.waitForSelector('.timeline');
    assert.match(await guest.textContent('#track-result'), /Pending/);
    await shot(guest, 'track-order');
  });
  await step('reservation: submit shows pending reference; status lookup works; conflicting request is refused', async () => {
    await go(guest, '/reserve'); await guest.fill('#f-name', 'Rita Guest'); await guest.fill('#f-phone', '+92 300 7770000'); await guest.fill('#f-email', 'rita@example.com');
    await guest.fill('#f-date', tomorrow); await guest.fill('#f-time', '19:00'); await guest.fill('#f-guests', '8');
    await guest.click('#res-form button[type=submit]'); await guest.waitForSelector('#res-ref');
    const ref = (await guest.textContent('#res-ref')).trim(); assert.match(ref, /^RES-/);
    assert.match(await guest.textContent('#res-result'), /pending/i);
    await guest.fill('#res-form #f-date', tomorrow); await guest.fill('#res-form #f-time', '19:30'); await guest.fill('#res-form #f-guests', '8'); await guest.fill('#res-form #f-name', 'Second Party'); await guest.fill('#res-form #f-phone', '+92 300 7771111'); await guest.fill('#res-form #f-email', 'second@example.com');
    await guest.click('#res-form button[type=submit]'); await guest.waitForSelector('#res-form [data-form-error]:not(:empty)');
    assert.match(await guest.textContent('#res-form [data-form-error]'), /no table is available/i);
    await guest.fill('#lk-ref', ref); await guest.fill('#lk-phone', '+92 300 7770000'); await guest.click('#lookup-form button[type=submit]');
    await guest.waitForSelector('#lookup-result .card'); assert.match(await guest.textContent('#lookup-result'), /Not confirmed yet/);
  });
  await step('reservation validation: past date and bad guests are rejected by the server', async () => {
    await go(guest, '/reserve'); await guest.fill('#f-name', 'Past Person'); await guest.fill('#f-phone', '+92 300 8880000'); await guest.fill('#f-email', 'past@example.com');
    await guest.evaluate(() => document.getElementById('f-date').removeAttribute('min')); await guest.fill('#f-date', '2020-01-01'); await guest.fill('#f-guests', '2');
    await guest.click('#res-form button[type=submit]'); await guest.waitForSelector('[data-error-for=date]:not(:empty)');
  });
  await step('contact form validates and stores the message', async () => {
    await go(guest, '/contact'); await guest.click('#contact-form button[type=submit]'); await guest.waitForSelector('[data-error-for=email]:not(:empty)');
    await guest.fill('#f-name', 'Sam <b>Writer</b>'); await guest.fill('#f-email', 'sam@example.com'); await guest.fill('#f-message', 'Hello <script>alert(1)</script> there');
    await guest.click('#contact-form button[type=submit]'); await guest.waitForSelector('.toast-success');
    assert.equal(app.db.prepare('SELECT COUNT(*) n FROM contact_messages').get().n, 1);
  });
  await step('about page renders editable content', async () => { await go(guest, '/about'); assert.match(await guest.textContent('main'), /Our Mission/); });
  await step('unknown route shows a friendly 404 page', async () => { await go(guest, '/nope/nothing'); assert.match(await guest.textContent('main'), /Page not found/); });
  await step('guests are redirected to sign in for account and admin pages', async () => {
    await guest.goto(`${base}/#/account`); await guest.waitForSelector('#login-form'); assert.match(guest.url(), /login\?next=/);
    await guest.goto(`${base}/#/admin`); await guest.waitForSelector('#login-form');
  });

  // ================================================================ registered customer
  const cust = await newPage();
  await step('customer: register, order while signed in, see and cancel it in the account area', async () => {
    await go(cust, '/register'); await cust.click('#reg-form button[type=submit]'); await cust.waitForSelector('[data-error-for=email]:not(:empty)');
    await cust.fill('#f-name', 'Carol Customer'); await cust.fill('#f-email', 'carol@example.com'); await cust.fill('#f-phone', '+92 300 1112222'); await cust.fill('#f-password', 'weak');
    await cust.click('#reg-form button[type=submit]'); await cust.waitForSelector('[data-error-for=password]:not(:empty)');
    await cust.fill('#f-password', 'Passw0rd123'); await cust.click('#reg-form button[type=submit]'); await cust.waitForSelector('.tabs');
    await go(cust, '/menu'); await cust.waitForSelector('.food-card'); await cust.locator('.food-card').nth(5).locator('button:has-text("Add to Cart")').click();
    await go(cust, '/checkout'); assert.equal(await cust.inputValue('#f-name'), 'Carol Customer');
    await cust.click('input[name=orderType][value=pickup]'); await cust.click('#checkout-form button[type=submit]'); await cust.waitForSelector('#order-number');
    await go(cust, '/account/orders'); await cust.waitForSelector('.card:has-text("ORD-")');
    assert.match(await cust.textContent('main'), /Current orders/);
    await cust.click('[data-action=cancel-order]'); await cust.waitForSelector('.card .status-cancelled');
    await shot(cust, 'account-orders');
  });
  await step('customer: profile update and password change', async () => {
    await go(cust, '/account/profile'); await cust.fill('#f-name', 'Carol Updated'); await cust.click('#profile-form button[type=submit]'); await cust.waitForSelector('.toast-success');
    assert.equal(app.db.prepare("SELECT name FROM users WHERE email='carol@example.com'").get().name, 'Carol Updated');
    await go(cust, '/account/password'); await cust.fill('#f-current', 'wrongpass1'); await cust.fill('#f-password', 'NewPassw0rd1'); await cust.click('#pw-form button[type=submit]'); await cust.waitForSelector('[data-error-for=current]:not(:empty)');
  });
  await step('customer cannot open the admin dashboard', async () => {
    await go(cust, '/admin'); assert.match(await cust.textContent('main'), /Administrator access is required/);
    const r = await cust.evaluate(() => fetch('/api/admin/stats').then((x) => x.status)); assert.equal(r, 403);
  });
  await step('customer: reservation appears in account and can be cancelled', async () => {
    await go(cust, '/reserve'); await cust.fill('#f-date', tomorrow); await cust.fill('#f-time', '13:00'); await cust.fill('#f-guests', '2');
    await cust.click('#res-form button[type=submit]'); await cust.waitForSelector('#res-ref');
    await go(cust, '/account/reservations'); await cust.waitForSelector('.card:has-text("RES-")'); await cust.click('[data-action=cancel-res]'); await cust.waitForSelector('.status-cancelled');
  });
  await step('sign out returns to the public site', async () => {
    await cust.click('a[data-action=logout]'); await cust.waitForSelector('.nav-tools a:has-text("Sign in")'); assert.equal(await cust.locator('a[data-action=logout]').count(), 0);
  });

  // ================================================================ admin
  const adm = await newPage();
  await step('admin: wrong password rejected, correct login lands on dashboard with real stats', async () => {
    await go(adm, '/login'); await adm.fill('#f-email', 'admin@e2e.local'); await adm.fill('#f-password', 'nope-nope1'); await adm.click('#login-form button[type=submit]');
    await adm.waitForSelector('[data-form-error]:not(:empty)');
    await adm.fill('#f-password', 'AdminPass123'); await adm.click('#login-form button[type=submit]'); await adm.waitForSelector('.stat-grid'); await adm.waitForSelector('svg.chart');
    const total = app.db.prepare('SELECT COUNT(*) n FROM orders').get().n;
    assert.match(await adm.textContent('.stat:has(.label:text("Total orders")) .value'), new RegExp('^' + total + '$'));
    assert.ok(total >= 3);
    await shot(adm, 'admin-dashboard');
  });
  await step('admin: open order, accept, progress through pickup statuses, history recorded', async () => {
    await go(adm, '/admin/orders'); await adm.waitForSelector('table.table'); await adm.click(`a:has-text("${orderNumber}")`); await adm.waitForSelector('.timeline');
    await adm.click('button:has-text("Accept order")'); await adm.waitForSelector('.status-confirmed');
    await adm.click('button:has-text("Mark: Preparing")'); await adm.waitForSelector('.status-preparing');
    await adm.click('button:has-text("Mark: Ready for Pickup")'); await adm.waitForSelector('.status-ready');
    await adm.click('button:has-text("Mark: Delivered")'); await adm.waitForSelector('.status-delivered');
    assert.equal(await adm.locator('button:has-text("Accept order")').count(), 0);
    assert.equal(app.db.prepare("SELECT status FROM orders WHERE order_number=?").get(orderNumber).status, 'delivered');
    await shot(adm, 'admin-order-detail');
  });
  await step('guest tracking reflects the admin status change', async () => {
    await go(guest, '/track'); await guest.fill('#f-orderNumber', orderNumber); await guest.fill('#f-phone', '+92 300 5551234'); await guest.click('#track-form button[type=submit]');
    await guest.waitForSelector('.timeline li.current:has-text("Delivered")');
  });
  await step('admin: reject an order with a reason; filters and search work', async () => {
    const pending = app.db.prepare("SELECT id FROM orders WHERE status='pending' ORDER BY id LIMIT 1").get();
    await go(adm, '/admin/orders/' + pending.id); await adm.click('button:has-text("Reject order")'); await adm.waitForSelector('.status-cancelled');
    assert.equal(app.db.prepare('SELECT cancel_reason r FROM orders WHERE id=?').get(pending.id).r, 'Out of stock');
    await go(adm, '/admin/orders'); await adm.selectOption('#f-status', 'cancelled'); await adm.click('#filters button[type=submit]');
    await adm.waitForFunction(() => [...document.querySelectorAll('tbody .status')].every((s) => s.textContent === 'Cancelled') && document.querySelectorAll('tbody .status').length >= 1);
    await adm.fill('#f-q', 'zzz-no-match'); await adm.click('#filters button[type=submit]'); await adm.waitForSelector('.empty');
  });
  await step('admin: add food with image upload, appears on public menu, edit price, toggle availability, delete', async () => {
    await go(adm, '/admin/foods'); await adm.waitForSelector('table.table');
    await adm.click('button:has-text("Add food item")'); await adm.waitForSelector('dialog[open]');
    await adm.fill('dialog #f-name', 'E2E Special Burger'); await adm.fill('dialog #f-description', 'Created by the browser test.'); await adm.fill('dialog #f-price_cents', '12.50');
    await adm.selectOption('dialog #f-category_id', { label: 'Burgers' });
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    await adm.setInputFiles('dialog #f-image', { name: 'burger.png', mimeType: 'image/png', buffer: png }); await adm.waitForFunction(() => document.querySelector('dialog [name=image_url]').value.startsWith('/uploads/'));
    await adm.click('dialog [data-action=add-var]'); await adm.fill('dialog .sub-row .s-name', 'Regular'); await adm.fill('dialog .sub-row .s-price', '0');
    await adm.click('dialog [data-action=add-ex]'); await adm.fill('dialog #ex-rows .s-name', 'Bacon'); await adm.fill('dialog #ex-rows .s-price', '1.75');
    await adm.click('dialog button[type=submit]'); await adm.waitForSelector('tr:has-text("E2E Special Burger")');
    await go(guest, '/menu'); await guest.waitForSelector('.food-card:has-text("E2E Special Burger")'); assert.equal(await guest.locator('.food-card').count(), 17);
    assert.equal(await guest.locator('.food-card:has-text("E2E Special Burger") img').evaluate((i) => i.naturalWidth > 0), true);
    await adm.click('tr:has-text("E2E Special Burger") [data-action=edit]'); await adm.waitForSelector('dialog[open] #f-name');
    assert.equal(await adm.inputValue('dialog #f-price_cents'), '12.50'); await adm.fill('dialog #f-price_cents', '13.25'); await adm.click('dialog button[type=submit]'); await adm.waitForSelector('tr:has-text("$13.25")');
    await adm.uncheck('tr:has-text("E2E Special Burger") [data-key=available]'); await adm.waitForSelector('.toast-success');
    await go(guest, '/menu'); assert.match(await guest.textContent('.food-card:has-text("E2E Special Burger")'), /Unavailable/);
    assert.equal(await guest.locator('.food-card:has-text("E2E Special Burger") button').isDisabled(), true);
    await adm.click('tr:has-text("E2E Special Burger") [data-action=delete]'); await adm.waitForFunction(() => !document.body.textContent.includes('E2E Special Burger'));
    await adm.click('button:has-text("Add food item")'); await adm.fill('dialog #f-name', 'X'); await adm.fill('dialog #f-price_cents', 'abc'); await adm.click('dialog button[type=submit]');
    await adm.waitForSelector('dialog [data-error-for=price_cents]:not(:empty)'); await adm.click('dialog button:has-text("Cancel")');
  });
  await step('admin: categories add / duplicate rejected / delete', async () => {
    await go(adm, '/admin/categories'); await adm.click('button:has-text("Add category")'); await adm.fill('dialog #f-name', 'Salads'); await adm.click('dialog button[type=submit]'); await adm.waitForSelector('tr:has-text("Salads")');
    await adm.click('button:has-text("Add category")'); await adm.fill('dialog #f-name', 'salads'); await adm.click('dialog button[type=submit]'); await adm.waitForSelector('dialog [data-form-error]:not(:empty)'); await adm.click('dialog button:has-text("Cancel")');
    await adm.click('tr:has-text("Salads") [data-action=delete]'); await adm.waitForFunction(() => !document.body.textContent.includes('Salads'));
  });
  await step('admin: approve a reservation, conflicting table change refused, reject frees slot', async () => {
    await go(adm, '/admin/reservations'); await adm.waitForSelector('table.table');
    const row = adm.locator('tr:has-text("Rita Guest")'); await row.locator('button:has-text("Approve")').click(); await adm.waitForSelector('tr:has-text("Rita Guest") .status-approved');
    assert.equal(app.db.prepare("SELECT status FROM reservations WHERE name='Rita Guest'").get().status, 'approved');
    await adm.locator('tr:has-text("Rita Guest") button:has-text("Cancel")').click(); await adm.waitForSelector('tr:has-text("Rita Guest") .status-cancelled');
  });
  await step('admin: customers list and detail show order history', async () => {
    await go(adm, '/admin/customers'); await adm.waitForSelector('a:has-text("Carol Updated")'); await adm.click('a:has-text("Carol Updated")'); await adm.waitForSelector('h2:has-text("Order history")');
    assert.match(await adm.textContent('main'), /ORD-/);
  });
  await step('admin: reports (daily/weekly/monthly) use real sales data and best sellers', async () => {
    await go(adm, '/admin/reports'); await adm.waitForSelector('svg.chart');
    const rev = app.db.prepare("SELECT SUM(total_cents) s FROM orders WHERE status!='cancelled'").get().s;
    const fmt = '$' + (rev / 100).toFixed(2);
    assert.ok((await adm.textContent('.stat.accent .value')).includes(fmt), `expected ${fmt}`);
    await adm.click('[data-p=weekly]'); await adm.waitForSelector('[data-p=weekly][aria-current=page]'); await adm.click('[data-p=monthly]'); await adm.waitForSelector('[data-p=monthly][aria-current=page]');
    assert.ok((await adm.locator('progress').count()) >= 1);
    await shot(adm, 'admin-reports');
  });
  await step('admin: messages are listed (escaped, not executed) and can be deleted', async () => {
    await go(adm, '/admin/messages'); await adm.waitForSelector('.msg');
    assert.match(await adm.textContent('.msg'), /<script>alert\(1\)<\/script>/); assert.equal(await adm.locator('.msg script').count(), 0);
    await adm.click('.msg [data-action=del]'); await adm.waitForSelector('.empty');
  });
  await step('admin: website settings change appears on the public site', async () => {
    await go(adm, '/admin/website'); await adm.waitForSelector('#settings');
    await adm.fill('#f-restaurant_name', 'E2E Bistro'); await adm.fill('#f-phone', '+1 555 010 0199'); await adm.fill('#f-delivery_fee_cents', '4.50');
    await adm.click('#settings button[type=submit]'); await adm.waitForSelector('.toast-success');
    await guest.reload(); await ready(guest); await go(guest, '/contact'); assert.match(await guest.textContent('.site-header'), /E2E Bistro/); assert.match(await guest.textContent('main'), /555 010 0199/);
    assert.equal(app.db.prepare("SELECT value FROM settings WHERE key='delivery_fee_cents'").get().value, '450');
    await adm.fill('#f-facebook', 'javascript:alert(1)'); await adm.click('#settings button[type=submit]'); await adm.waitForSelector('[data-error-for=facebook]:not(:empty)');
    await adm.fill('#f-facebook', '');
  });
  await step('admin: add discount code through the UI and use it on the cart', async () => {
    await adm.waitForSelector('#codes'); await adm.click('#codes button:has-text("Add")'); await adm.fill('dialog #f-code', 'UITEST5'); await adm.fill('dialog #f-percent', '5'); await adm.click('dialog button[type=submit]'); await adm.waitForSelector('#codes tr:has-text("UITEST5")');
    await go(guest, '/menu'); await guest.waitForSelector('.food-card'); await guest.locator('.food-card').nth(1).locator('button:has-text("Add to Cart")').click();
    await go(guest, '/cart'); await guest.waitForSelector('.cart-item'); await guest.fill('#code', 'uitest5'); await guest.click('#code-form button'); await guest.waitForSelector('.summary .discount');
  });

  // ================================================================ layout & responsiveness
  const WIDTHS = [320, 375, 414, 768, 1024, 1440];
  const SITE_PAGES = ['/', '/menu', '/about', '/cart', '/track', '/reserve', '/contact', '/login', '/register'];
  const ADMIN_PAGES = ['/admin', '/admin/orders', '/admin/foods', '/admin/categories', '/admin/reservations', '/admin/customers', '/admin/reports', '/admin/website', '/admin/messages'];
  const cookies = await adm.context().cookies();
  for (const w of WIDTHS) {
    await step(`no horizontal scroll, broken images or clipped nav at ${w}px (site + admin pages)`, async () => {
      const p = await newPage(w, 800); await p.context().addCookies(cookies);
      await go(p, '/menu'); await p.waitForSelector('.food-card'); await p.locator('.food-card').first().locator('button:has-text("Add to Cart")').click();
      const bad = [];
      for (const route of [...SITE_PAGES, '/checkout', '/menu/1', ...ADMIN_PAGES, '/admin/orders/1']) {
        await go(p, route); await p.waitForTimeout(150);
        await p.evaluate(() => document.querySelectorAll('img[loading=lazy]').forEach((i) => { i.loading = 'eager'; })); await p.waitForTimeout(100);
        const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, broken: [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).length }));
        if (m.sw > m.iw) bad.push(`${route}: scrollWidth ${m.sw} > ${m.iw}`);
        if (m.broken) bad.push(`${route}: ${m.broken} broken image(s)`);
      }
      if (w === 375) { await go(p, '/'); await shot(p, 'home-mobile'); await p.click('.nav-toggle'); await p.waitForSelector('.nav.open'); assert.ok(await p.locator('.nav.open a:has-text("Menu")').isVisible()); await shot(p, 'mobile-menu-open'); await go(p, '/menu'); await shot(p, 'menu-mobile'); }
      assert.deepEqual(bad, [], bad.join('\n'));
      await p.context().close();
    });
  }

  await step('no JavaScript errors, CSP violations or failed requests were logged during the whole run', async () => {
    const real = problems.filter((x) => !/status of 4\d\d|Failed to load resource: the server responded with a status of (401|403|404|409|422|429)/.test(x));
    assert.deepEqual(real, [], 'logged problems:\n' + real.join('\n'));
  });

  await browser.close(); await app.close(); fs.rmSync(tmp, { recursive: true, force: true });
  const pass = results.filter((r) => r[1]).length; const fail = results.length - pass;
  console.log(`\nE2E: ${pass} passed, ${fail} failed, ${results.length} total`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('E2E crashed:', e); process.exit(2); });
