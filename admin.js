// Admin dashboard pages. All data comes from /api/admin/* (server enforces the admin role).
import {
  html, raw, get, post, put, patch, del, state, icon, money, parseMoney, toMoneyInput, actions, toast, field, handleForm,
  foodImg, setTitle, statusBadge, fmtDateTime, fmtDate, STATUS_LABELS, ApiError, lines,
} from './lib.js';

const show = (main, view) => { main.innerHTML = view.s; };
const head = (title, extra = '') => html`<div class="row row-between"><h1>${title}</h1><div class="row">${extra}</div></div>`;
const loader = (main) => { main.innerHTML = '<div class="loader" role="status">Loading…</div>'; };
const empty = (msg) => html`<div class="empty"><span class="em">📭</span>${msg}</div>`;
const yesNo = (v) => (v ? 'Yes' : 'No');
const guard = (fn) => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message || 'Something went wrong', 'error'); } };

/** Modal dialog with a form. onSubmit(values, form, dialog) may throw ApiError to show field errors. */
function modal(title, body, onSubmit, submitLabel = 'Save') {
  const d = document.createElement('dialog');
  d.innerHTML = html`<form id="modal-form" novalidate><div class="dialog-head"><h2>${title}</h2><button type="button" class="icon-btn" data-close aria-label="Close">${icon('x')}</button></div>
    <div class="dialog-body">${body}<p class="form-error" data-form-error role="alert"></p>
    <div class="dialog-foot"><button type="button" class="btn btn-outline" data-close>Cancel</button><button class="btn" type="submit">${submitLabel}</button></div></div></form>`.s;
  document.body.appendChild(d);
  d.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) d.close(); });
  d.addEventListener('close', () => d.remove());
  handleForm(d.querySelector('form'), async (v, f) => { await onSubmit(v, f, d); d.close(); });
  d.showModal();
  return d;
}

// ---------- charts ----------
function barChart(data, { fmt = String, label }) {
  const W = 640; const H = 240; const L = 56; const B = 30; const T = 14;
  const max = Math.max(1, ...data.map((d) => d.value));
  const pw = (W - L - 10) / data.length; const bw = Math.max(4, pw * 0.62);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const step = Math.ceil(data.length / 8);
  return html`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">
    ${ticks.map((t) => { const y = T + (H - T - B) * (1 - t); return html`<line class="grid-line" x1="${L}" x2="${W - 6}" y1="${y}" y2="${y}"/><text x="${L - 6}" y="${y + 4}" text-anchor="end">${fmt(Math.round(max * t))}</text>`; })}
    ${data.map((d, i) => { const h = (H - T - B) * (d.value / max); const x = L + i * pw + (pw - bw) / 2; return html`<rect class="bar" x="${x}" y="${T + (H - T - B) - h}" width="${bw}" height="${Math.max(h, d.value ? 2 : 0)}" rx="3"><title>${d.label}: ${fmt(d.value)}</title></rect>${i % step === 0 ? html`<text x="${x + bw / 2}" y="${H - 10}" text-anchor="middle">${d.label}</text>` : ''}`; })}
  </svg>`;
}

// ---------- dashboard ----------
export async function dashboard(main, ctx) {
  setTitle('Admin Dashboard'); loader(main);
  const s = await get('/api/admin/stats'); if (ctx.stale()) return;
  const stat = (label, value, cls = '') => html`<div class="stat ${cls}"><div class="label">${label}</div><div class="value">${value}</div></div>`;
  show(main, html`${head('Dashboard')}
  <div class="stat-grid">
    ${stat('Total orders', s.totalOrders)}${stat('Pending orders', s.pendingOrders)}${stat('Completed orders', s.completedOrders)}
    ${stat('Customers', s.totalCustomers)}${stat('Menu items', s.menuItems)}${stat('Reservations', `${s.totalReservations} (${s.pendingReservations} pending)`)}
    ${stat('Revenue (all, excl. cancelled)', money(s.revenueTotal), 'accent')}${stat('Revenue (delivered)', money(s.revenueDelivered), 'accent')}${stat('Revenue today', money(s.revenueToday), 'accent')}
  </div>
  <div class="card"><h2>Revenue - last 7 days</h2>${barChart(s.last7Days.map((d) => ({ label: d.day.slice(5), value: d.revenue })), { fmt: money, label: 'Revenue for the last 7 days' })}</div>
  <h2 class="muted">Recent orders</h2>
  ${s.recentOrders.length ? html`<div class="table-wrap"><table class="table"><thead><tr><th>Order</th><th>Customer</th><th class="num">Total</th><th>Status</th><th>Placed</th></tr></thead><tbody>
    ${s.recentOrders.map((o) => html`<tr><td><a href="#/admin/orders/${o.id}">${o.order_number}</a></td><td>${o.customer_name}</td><td class="num">${money(o.total_cents)}</td><td>${statusBadge(o.status)}</td><td>${fmtDateTime(o.created_at)}</td></tr>`)}</tbody></table></div>` : empty('No orders yet.')}
  ${s.unreadMessages ? html`<p class="alert alert-info"><a href="#/admin/messages">${s.unreadMessages} unread message(s)</a></p>` : ''}`);
}

// ---------- categories ----------
export async function categories(main, ctx) {
  setTitle('Categories');
  async function draw() {
    const rows = await get('/api/admin/categories'); if (ctx.stale()) return;
    show(main, html`${head('Categories', html`<button class="btn" data-action="new">${icon('plus')} Add category</button>`)}
    ${rows.length ? html`<div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Items</th><th>Order</th><th>Visible</th><th></th></tr></thead><tbody>
      ${rows.map((c) => html`<tr><td><strong>${c.name}</strong><br><small class="muted">${c.description}</small></td><td>${c.item_count}</td><td>${c.sort_order}</td><td>${yesNo(c.active)}</td>
        <td class="actions"><button class="btn btn-sm btn-outline" data-action="edit" data-id="${c.id}">Edit</button><button class="btn btn-sm btn-danger" data-action="delete" data-id="${c.id}" data-name="${c.name}">Delete</button></td></tr>`)}</tbody></table></div>` : empty('No categories yet.')}`);
    main._rows = rows;
  }
  const form = (c = {}) => html`${field({ name: 'name', label: 'Name', required: true, value: c.name || '', attrs: { maxlength: 60 } })}
    ${field({ name: 'description', label: 'Description', value: c.description || '', attrs: { maxlength: 200 } })}
    ${field({ name: 'sort_order', label: 'Sort order', type: 'number', value: c.sort_order ?? 0, attrs: { min: 0 } })}${field({ name: 'active', label: 'Visible on the website', type: 'checkbox', value: c.active ?? 1 })}`;
  await draw();
  actions(main, 'click', {
    new: () => modal('Add category', form(), async (v) => { await post('/api/admin/categories', { ...v, sort_order: Number(v.sort_order) }); toast('Category added'); await draw(); }),
    edit: (b) => { const c = main._rows.find((x) => x.id === Number(b.dataset.id)); modal('Edit category', form(c), async (v) => { await put('/api/admin/categories/' + c.id, { ...v, sort_order: Number(v.sort_order) }); toast('Category saved'); await draw(); }); },
    delete: guard(async (b) => { if (!confirm(`Delete category "${b.dataset.name}"?`)) return; await del('/api/admin/categories/' + b.dataset.id); toast('Category deleted'); await draw(); }),
  });
}

// ---------- food items ----------
export async function foods(main, ctx) {
  setTitle('Food Items');
  let cats = []; let rows = [];
  async function draw() {
    [cats, rows] = await Promise.all([get('/api/admin/categories'), get('/api/admin/foods')]); if (ctx.stale()) return;
    show(main, html`${head('Food Items', html`<button class="btn" data-action="new">${icon('plus')} Add food item</button>`)}
    ${cats.length ? '' : html`<div class="alert alert-warn">Create a category first (Categories page).</div>`}
    ${rows.length ? html`<div class="table-wrap"><table class="table"><thead><tr><th></th><th>Name</th><th>Category</th><th class="num">Price</th><th>Available</th><th>Featured</th><th>Popular</th><th></th></tr></thead><tbody>
      ${rows.map((f) => html`<tr><td>${foodImg(f, 'thumb-sm')}</td><td><strong>${f.name}</strong></td><td>${f.category_name}</td><td class="num">${money(f.price_cents)}</td>
        ${['available', 'featured', 'popular'].map((k) => html`<td><input type="checkbox" data-action="flag" data-key="${k}" data-id="${f.id}" aria-label="${k} for ${f.name}" ${f[k] ? raw('checked') : ''}></td>`)}
        <td class="actions"><button class="btn btn-sm btn-outline" data-action="edit" data-id="${f.id}">Edit</button><button class="btn btn-sm btn-danger" data-action="delete" data-id="${f.id}" data-name="${f.name}">Delete</button></td></tr>`)}</tbody></table></div>` : empty('No food items yet.')}`);
  }
  const subRow = (kind, r = {}) => html`<div class="sub-row" data-sub="${kind}"><input class="s-name" placeholder="${kind === 'var' ? 'Size / option (e.g. Large)' : 'Extra (e.g. Cheese)'}" value="${r.name || ''}" maxlength="40" aria-label="Name"><input class="s-price" placeholder="${kind === 'var' ? '+ price' : 'price'}" value="${toMoneyInput(kind === 'var' ? r.price_delta_cents : r.price_cents)}" inputmode="decimal" aria-label="Price"><button type="button" class="icon-btn" data-action="rm-sub" aria-label="Remove">${icon('trash')}</button></div>`;
  function foodForm(f = {}) {
    return html`<div class="form-grid">
      ${field({ name: 'name', label: 'Name', required: true, value: f.name || '', attrs: { maxlength: 80 } })}
      ${field({ name: 'category_id', label: 'Category', type: 'select', value: f.category_id || '', options: cats.map((c) => ({ value: c.id, label: c.name })) })}
      ${field({ name: 'price_cents', label: 'Price', value: toMoneyInput(f.price_cents || 0), required: true, attrs: { inputmode: 'decimal' } })}
      <div class="field"><label for="f-image">Image</label><input id="f-image" type="file" accept="image/png,image/jpeg,image/gif,image/webp"><input type="hidden" name="image_url" value="${f.image_url || ''}"><p class="field-error" data-error-for="image_url" role="alert"></p>
        <img class="img-preview" id="img-preview" alt="Preview" ${f.image_url ? '' : raw('hidden')} src="${f.image_url || ''}"></div>
      <div class="full">${field({ name: 'description', label: 'Description', type: 'textarea', value: f.description || '', rows: 3, attrs: { maxlength: 500 } })}</div>
      <div class="full row">${field({ name: 'available', label: 'Available', type: 'checkbox', value: f.available ?? 1 })}${field({ name: 'featured', label: 'Featured', type: 'checkbox', value: f.featured })}${field({ name: 'popular', label: 'Popular', type: 'checkbox', value: f.popular })}</div>
    </div>
    <h3>Sizes / options <small class="muted">(first is the default; price is added to the base price)</small></h3>
    <div class="sub-rows" id="var-rows">${(f.variations || []).map((v) => subRow('var', v))}</div><button type="button" class="btn btn-sm btn-outline" data-action="add-var">${icon('plus')} Add option</button>
    <h3>Extras</h3><div class="sub-rows" id="ex-rows">${(f.extras || []).map((x) => subRow('ex', x))}</div><button type="button" class="btn btn-sm btn-outline" data-action="add-ex">${icon('plus')} Add extra</button><p></p>
    <p class="field-error" data-error-for="variations" role="alert"></p><p class="field-error" data-error-for="extras" role="alert"></p>`;
  }
  function openForm(existing) {
    const d = modal(existing ? 'Edit food item' : 'Add food item', foodForm(existing || {}), async (v) => {
      const price = parseMoney(v.price_cents);
      if (Number.isNaN(price)) throw new ApiError(422, 'Please correct the highlighted fields.', { price_cents: 'Enter a valid price, e.g. 8.99' });
      const read = (kind, key) => [...d.querySelectorAll(`[data-sub=${kind}]`)].map((r) => ({ name: r.querySelector('.s-name').value.trim(), [key]: parseMoney(r.querySelector('.s-price').value || '0') })).filter((r) => r.name);
      const body = { ...v, category_id: Number(v.category_id), price_cents: price, variations: read('var', 'price_delta_cents'), extras: read('ex', 'price_cents') };
      if ([...body.variations, ...body.extras].some((r) => Object.values(r).some((x) => Number.isNaN(x)))) throw new ApiError(422, 'Option prices must be numbers.');
      if (existing) await put('/api/admin/foods/' + existing.id, body); else await post('/api/admin/foods', body);
      toast('Food item saved'); await draw();
    });
    actions(d, 'click', {
      'add-var': () => d.querySelector('#var-rows').insertAdjacentHTML('beforeend', subRow('var').s),
      'add-ex': () => d.querySelector('#ex-rows').insertAdjacentHTML('beforeend', subRow('ex').s),
      'rm-sub': (b) => b.closest('.sub-row').remove(),
    });
    d.querySelector('#f-image').addEventListener('change', guard(async (e) => {
      const file = e.target.files[0]; if (!file) return;
      if (file.size > 2 * 1024 * 1024) { toast('Image must be 2 MB or smaller', 'error'); e.target.value = ''; return; }
      const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
      const { url } = await post('/api/admin/upload', { dataUrl });
      d.querySelector('[name=image_url]').value = url; const p = d.querySelector('#img-preview'); p.src = url; p.hidden = false; toast('Image uploaded');
    }));
  }
  await draw();
  actions(main, 'click', {
    new: () => openForm(null),
    edit: guard(async (b) => openForm(await get('/api/admin/foods/' + b.dataset.id))),
    delete: guard(async (b) => { if (!confirm(`Delete "${b.dataset.name}"? Past orders keep their own copy of this item.`)) return; await del('/api/admin/foods/' + b.dataset.id); toast('Food item deleted'); await draw(); }),
  });
  main.addEventListener('change', guard(async (e) => {
    const t = e.target.closest('[data-action=flag]'); if (!t) return;
    try { await patch(`/api/admin/foods/${t.dataset.id}/flags`, { [t.dataset.key]: t.checked }); toast('Updated'); } catch (err) { t.checked = !t.checked; throw err; }
  }));
}

// ---------- orders ----------
export async function orders(main, ctx) {
  setTitle('Orders');
  const f = { q: '', status: '', from: '', to: '', page: 1 };
  show(main, html`${head('Orders')}
  <form id="filters" class="filters" novalidate>
    ${field({ name: 'q', label: 'Search', attrs: { placeholder: 'Order #, name, phone, email', maxlength: 60 } })}
    ${field({ name: 'status', label: 'Status', type: 'select', options: [{ value: '', label: 'All statuses' }, ...Object.entries(STATUS_LABELS).filter(([k]) => !['approved', 'rejected', 'completed'].includes(k)).map(([value, label]) => ({ value, label }))] })}
    ${field({ name: 'from', label: 'From', type: 'date' })}${field({ name: 'to', label: 'To', type: 'date' })}
    <button class="btn" type="submit">Filter</button><button class="btn btn-outline" type="reset" data-action="reset">Reset</button></form>
  <div id="list"><div class="loader">Loading…</div></div>`);
  const list = main.querySelector('#list');
  const load = guard(async () => {
    const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)); const d = await get('/api/admin/orders?' + qs); if (ctx.stale()) return;
    list.innerHTML = (d.orders.length ? html`<p class="muted">${d.total} order(s)</p><div class="table-wrap"><table class="table"><thead><tr><th>Order</th><th>Customer</th><th>Type</th><th>Payment</th><th class="num">Total</th><th>Status</th><th>Placed</th></tr></thead><tbody>
      ${d.orders.map((o) => html`<tr><td><a href="#/admin/orders/${o.id}">${o.order_number}</a></td><td>${o.customer_name}<br><small class="muted">${o.phone}</small></td><td>${o.order_type}</td><td>${o.payment_method === 'cod' ? 'Cash' : 'Online'}</td><td class="num">${money(o.total_cents)}</td><td>${statusBadge(o.status)}</td><td>${fmtDateTime(o.created_at)}</td></tr>`)}</tbody></table></div>
      <div class="pager"><button class="btn btn-sm btn-outline" data-action="prev" ${d.page <= 1 ? raw('disabled') : ''}>Previous</button><span>Page ${d.page} of ${d.pages}</span><button class="btn btn-sm btn-outline" data-action="next" ${d.page >= d.pages ? raw('disabled') : ''}>Next</button></div>` : empty('No orders match these filters.')).s;
  });
  await load();
  main.querySelector('#filters').addEventListener('submit', (e) => { e.preventDefault(); Object.assign(f, { q: e.target.q.value.trim(), status: e.target.status.value, from: e.target.from.value, to: e.target.to.value, page: 1 }); load(); });
  main.querySelector('#filters').addEventListener('reset', () => { Object.assign(f, { q: '', status: '', from: '', to: '', page: 1 }); setTimeout(load); });
  actions(main, 'click', { prev: () => { f.page--; load(); }, next: () => { f.page++; load(); } });
}

export async function orderDetail(main, ctx) {
  setTitle('Order'); loader(main);
  async function draw() {
    const o = await get('/api/admin/orders/' + ctx.params.id); if (ctx.stale()) return;
    setTitle('Order ' + o.order_number);
    show(main, html`<p><a href="#/admin/orders">&larr; All orders</a></p>${head('Order ' + o.order_number, statusBadge(o.status))}
    <div class="grid grid-2">
      <div class="card"><h2>Customer</h2><dl class="kv"><dt>Name</dt><dd>${o.customer_name}</dd><dt>Phone</dt><dd><a href="tel:${o.phone.replace(/[^+\d]/g, '')}">${o.phone}</a></dd><dt>Email</dt><dd>${o.email}</dd>
        <dt>Type</dt><dd>${o.order_type === 'delivery' ? 'Home delivery' : 'Pickup'}</dd>${o.order_type === 'delivery' ? html`<dt>Address</dt><dd>${o.address}, ${o.city}</dd>` : ''}
        <dt>Payment</dt><dd>${o.payment_method === 'cod' ? 'Cash on delivery / pickup' : 'Online'}</dd><dt>Placed</dt><dd>${fmtDateTime(o.created_at)}</dd>${o.notes ? html`<dt>Notes</dt><dd>${o.notes}</dd>` : ''}${o.cancel_reason ? html`<dt>Cancel reason</dt><dd>${o.cancel_reason}</dd>` : ''}</dl>
        ${o.user_id ? html`<a href="#/admin/customers/${o.user_id}">View customer account</a>` : html`<span class="muted">Guest order</span>`}</div>
      <div class="card"><h2>Update status</h2>
        ${o.next_statuses.length ? html`<div class="actions">${o.next_statuses.map((s) => html`<button class="btn ${s === 'cancelled' ? 'btn-danger' : s === 'confirmed' ? 'btn-ok' : ''}" data-action="status" data-s="${s}">${s === 'confirmed' ? 'Accept order' : s === 'cancelled' ? (o.status === 'pending' ? 'Reject order' : 'Cancel order') : 'Mark: ' + STATUS_LABELS[s]}</button>`)}</div>` : html`<p class="muted">This order is ${STATUS_LABELS[o.status].toLowerCase()} and cannot change further.</p>`}
        <h3>History</h3><ol class="timeline">${o.events.map((e) => html`<li class="done ${e.status === 'cancelled' ? 'bad' : ''}"><span class="dot"></span><strong>${STATUS_LABELS[e.status]}</strong><br><small>${fmtDateTime(e.created_at)}</small></li>`)}</ol></div></div>
    <div class="card"><h2>Items</h2><div class="table-wrap"><table class="table"><thead><tr><th>Item</th><th class="num">Unit</th><th class="num">Qty</th><th class="num">Line</th></tr></thead><tbody>
      ${o.items.map((i) => html`<tr><td><strong>${i.name}</strong>${i.variation_name ? ` (${i.variation_name})` : ''}${i.extras.length ? html`<br><small>${i.extras.map((e) => '+ ' + e.name).join(', ')}</small>` : ''}${i.instructions ? html`<br><em>“${i.instructions}”</em>` : ''}</td><td class="num">${money(i.unit_price_cents)}</td><td class="num">${i.quantity}</td><td class="num">${money(i.line_total_cents)}</td></tr>`)}</tbody></table></div>
      <div class="summary"><div class="line"><span>Subtotal</span><span>${money(o.subtotal_cents)}</span></div>${o.delivery_cents ? html`<div class="line"><span>Delivery</span><span>${money(o.delivery_cents)}</span></div>` : ''}${o.discount_cents ? html`<div class="line discount"><span>Discount ${o.discount_code}</span><span>-${money(o.discount_cents)}</span></div>` : ''}<div class="line total"><span>Total</span><span>${money(o.total_cents)}</span></div></div></div>`);
  }
  await draw();
  actions(main, 'click', {
    status: guard(async (b) => {
      let reason = '';
      if (b.dataset.s === 'cancelled') { reason = prompt('Reason for cancelling / rejecting (shown to the customer):', ''); if (reason === null) return; }
      await patch(`/api/admin/orders/${ctx.params.id}/status`, { status: b.dataset.s, reason }); toast('Order updated'); await draw();
    }),
  });
}

// ---------- customers ----------
export async function customers(main, ctx) {
  setTitle('Customers');
  show(main, html`${head('Customers')}<form id="f" class="filters" novalidate>${field({ name: 'q', label: 'Search', attrs: { placeholder: 'Name, email or phone', maxlength: 60 } })}<button class="btn" type="submit">Search</button></form><div id="list"><div class="loader">Loading…</div></div>`);
  const list = main.querySelector('#list');
  const load = guard(async (q = '') => {
    const rows = await get('/api/admin/customers?q=' + encodeURIComponent(q)); if (ctx.stale()) return;
    list.innerHTML = (rows.length ? html`<div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th class="num">Orders</th><th class="num">Spent</th><th>Joined</th></tr></thead><tbody>
      ${rows.map((c) => html`<tr><td><a href="#/admin/customers/${c.id}">${c.name}</a></td><td>${c.email}</td><td>${c.phone}</td><td class="num">${c.order_count}</td><td class="num">${money(c.spent_cents)}</td><td>${fmtDate(c.created_at)}</td></tr>`)}</tbody></table></div>` : empty('No customers found.')).s;
  });
  await load();
  main.querySelector('#f').addEventListener('submit', (e) => { e.preventDefault(); load(e.target.q.value.trim()); });
}
export async function customerDetail(main, ctx) {
  setTitle('Customer'); loader(main);
  const c = await get('/api/admin/customers/' + ctx.params.id); if (ctx.stale()) return;
  show(main, html`<p><a href="#/admin/customers">&larr; All customers</a></p>${head(c.name)}
  <div class="card"><dl class="kv"><dt>Email</dt><dd>${c.email}</dd><dt>Phone</dt><dd>${c.phone}</dd><dt>Joined</dt><dd>${fmtDate(c.created_at)}</dd></dl></div>
  <h2>Order history</h2>${c.orders.length ? html`<div class="table-wrap"><table class="table"><thead><tr><th>Order</th><th>Type</th><th class="num">Total</th><th>Status</th><th>Placed</th></tr></thead><tbody>${c.orders.map((o) => html`<tr><td><a href="#/admin/orders/${o.id}">${o.order_number}</a></td><td>${o.order_type}</td><td class="num">${money(o.total_cents)}</td><td>${statusBadge(o.status)}</td><td>${fmtDateTime(o.created_at)}</td></tr>`)}</tbody></table></div>` : empty('No orders.')}
  <h2>Reservations</h2>${c.reservations.length ? html`<div class="table-wrap"><table class="table"><thead><tr><th>Ref</th><th>Date</th><th>Guests</th><th>Status</th></tr></thead><tbody>${c.reservations.map((r) => html`<tr><td>${r.ref}</td><td>${fmtDate(r.res_date)} ${r.res_time}</td><td>${r.guests}</td><td>${statusBadge(r.status)}</td></tr>`)}</tbody></table></div>` : empty('No reservations.')}`);
}

// ---------- reservations ----------
const RES_ACTIONS = { pending: [['approved', 'Approve', 'btn-ok'], ['rejected', 'Reject', 'btn-danger']], approved: [['completed', 'Complete', ''], ['cancelled', 'Cancel', 'btn-danger']] };
export async function reservations(main, ctx) {
  setTitle('Reservations');
  const f = { status: '', date: '' };
  show(main, html`${head('Reservations')}<form id="f" class="filters" novalidate>
    ${field({ name: 'status', label: 'Status', type: 'select', options: [{ value: '', label: 'All' }, ...['pending', 'approved', 'rejected', 'cancelled', 'completed'].map((value) => ({ value, label: STATUS_LABELS[value] }))] })}
    ${field({ name: 'date', label: 'Date', type: 'date' })}<button class="btn" type="submit">Filter</button><button class="btn btn-outline" type="reset">Reset</button></form><div id="list"></div>`);
  const list = main.querySelector('#list'); let tables = [];
  const load = guard(async () => {
    if (!tables.length) tables = await get('/api/admin/tables');
    const rows = await get('/api/admin/reservations?' + new URLSearchParams(Object.entries(f).filter(([, v]) => v))); if (ctx.stale()) return;
    list.innerHTML = (rows.length ? html`<div class="table-wrap"><table class="table"><thead><tr><th>Ref</th><th>Guest</th><th>When</th><th>Guests</th><th>Table</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      ${rows.map((r) => html`<tr><td>${r.ref}</td><td>${r.name}<br><small class="muted">${r.phone} · ${r.email}</small>${r.requests ? html`<br><em>“${r.requests}”</em>` : ''}</td><td>${fmtDate(r.res_date)}<br>${r.res_time}</td><td>${r.guests}</td>
        <td>${['pending', 'approved'].includes(r.status) ? html`<select data-action="table" data-id="${r.id}" aria-label="Table for ${r.ref}">${tables.filter((t) => t.active && t.capacity >= r.guests).map((t) => html`<option value="${t.id}" ${t.id === r.table_id ? raw('selected') : ''}>${t.name} (${t.capacity})</option>`)}</select>` : (r.table_name || '-')}</td>
        <td>${statusBadge(r.status)}</td><td class="actions">${(RES_ACTIONS[r.status] || []).map(([s, l, c]) => html`<button class="btn btn-sm ${c}" data-action="set" data-id="${r.id}" data-s="${s}">${l}</button>`)}</td></tr>`)}</tbody></table></div>` : empty('No reservations found.')).s;
  });
  await load();
  main.querySelector('#f').addEventListener('submit', (e) => { e.preventDefault(); f.status = e.target.status.value; f.date = e.target.date.value; load(); });
  main.querySelector('#f').addEventListener('reset', () => { f.status = ''; f.date = ''; setTimeout(load); });
  actions(main, 'click', { set: guard(async (b) => { await patch('/api/admin/reservations/' + b.dataset.id, { status: b.dataset.s }); toast('Reservation updated'); await load(); }) });
  main.addEventListener('change', guard(async (e) => { const t = e.target.closest('[data-action=table]'); if (!t) return; try { await patch('/api/admin/reservations/' + t.dataset.id, { table_id: Number(t.value) }); toast('Table changed'); } catch (err) { await load(); throw err; } }));
}

// ---------- reports ----------
export async function reports(main, ctx) {
  setTitle('Sales Reports'); let period = 'daily';
  async function draw() {
    const r = await get('/api/admin/reports?period=' + period); if (ctx.stale()) return;
    const top = Math.max(1, ...r.best.map((b) => b.quantity));
    show(main, html`${head('Sales & Reports')}
    <div class="tabs" role="group" aria-label="Report period">${[['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']].map(([k, l]) => html`<a href="#/admin/reports" data-action="period" data-p="${k}" ${k === period ? raw('aria-current="page"') : ''}>${l}</a>`)}</div>
    <div class="stat-grid"><div class="stat"><div class="label">Orders (${r.label})</div><div class="value">${r.totals.orders}</div></div><div class="stat accent"><div class="label">Revenue</div><div class="value">${money(r.totals.revenue)}</div></div><div class="stat"><div class="label">Average order</div><div class="value">${money(r.totals.avg_order)}</div></div></div>
    <div class="card"><h2>Revenue - ${r.label}</h2>${r.rows.length ? barChart(r.rows.map((x) => ({ label: x.bucket.slice(period === 'monthly' ? 2 : period === 'weekly' ? 2 : 5), value: x.revenue })), { fmt: money, label: `${period} revenue` }) : empty('No sales in this period.')}</div>
    ${r.rows.length ? html`<h2>Breakdown</h2><div class="table-wrap"><table class="table"><thead><tr><th>Period</th><th class="num">Orders</th><th class="num">Revenue</th></tr></thead><tbody>${r.rows.map((x) => html`<tr><td>${x.bucket}</td><td class="num">${x.orders}</td><td class="num">${money(x.revenue)}</td></tr>`)}</tbody></table></div>` : ''}
    <h2>Best-selling items (all time, excl. cancelled)</h2>${r.best.length ? html`<div class="table-wrap"><table class="table"><thead><tr><th>Item</th><th class="num">Sold</th><th class="num">Revenue</th><th>Share of top seller</th></tr></thead><tbody>${r.best.map((b) => html`<tr><td>${b.name}</td><td class="num">${b.quantity}</td><td class="num">${money(b.revenue)}</td><td><progress max="${top}" value="${b.quantity}"></progress></td></tr>`)}</tbody></table></div>` : empty('No sales yet.')}
    <h2>Orders by status</h2><div class="row">${r.byStatus.map((s) => html`<span>${statusBadge(s.status)} ${s.n}</span>`)}</div>`);
  }
  await draw();
  actions(main, 'click', { period: guard(async (a, e) => { e.preventDefault(); period = a.dataset.p; await draw(); }) });
}

// ---------- messages ----------
export async function messages(main, ctx) {
  setTitle('Messages');
  async function draw() {
    const rows = await get('/api/admin/messages'); if (ctx.stale()) return;
    show(main, html`${head('Contact Messages')}${rows.length ? html`<div class="stack">${rows.map((m) => html`<div class="card msg ${m.is_read ? '' : 'unread'}"><div class="row row-between"><strong>${m.subject || '(no subject)'}</strong><small class="muted">${fmtDateTime(m.created_at)}</small></div>
      <p class="muted">${m.name} · <a href="mailto:${m.email}">${m.email}</a>${m.phone ? ' · ' + m.phone : ''}</p><p>${m.message}</p>
      <div class="actions"><button class="btn btn-sm btn-outline" data-action="read" data-id="${m.id}" data-read="${m.is_read ? '0' : '1'}">${m.is_read ? 'Mark unread' : 'Mark read'}</button><button class="btn btn-sm btn-danger" data-action="del" data-id="${m.id}">Delete</button></div></div>`)}</div>` : empty('No messages yet.')}`);
  }
  await draw();
  actions(main, 'click', {
    read: guard(async (b) => { await patch('/api/admin/messages/' + b.dataset.id, { is_read: b.dataset.read === '1' }); await draw(); }),
    del: guard(async (b) => { if (!confirm('Delete this message?')) return; await del('/api/admin/messages/' + b.dataset.id); toast('Message deleted'); await draw(); }),
  });
}

// ---------- website management ----------
const MONEY_KEYS = ['delivery_fee_cents', 'free_delivery_over_cents', 'min_order_cents'];
function crudBlock(root, cfg) {
  let rows = [];
  const draw = guard(async () => {
    rows = await get(cfg.endpoint);
    root.innerHTML = html`<div class="card"><div class="row row-between"><h2>${cfg.title}</h2><button class="btn btn-sm" data-action="new">${icon('plus')} Add</button></div>
      ${rows.length ? html`<div class="table-wrap"><table class="table"><thead><tr>${cfg.cols.map((c) => html`<th>${c[0]}</th>`)}<th></th></tr></thead><tbody>${rows.map((r) => html`<tr>${cfg.cols.map((c) => html`<td>${c[1](r)}</td>`)}<td class="actions"><button class="btn btn-sm btn-outline" data-action="edit" data-id="${r.id}">Edit</button><button class="btn btn-sm btn-danger" data-action="del" data-id="${r.id}">Delete</button></td></tr>`)}</tbody></table></div>` : empty(cfg.empty)}</div>`.s;
  });
  const open = (r) => modal((r ? 'Edit ' : 'Add ') + cfg.single, cfg.form(r || {}), async (v) => { const body = cfg.body(v); if (r) await put(`${cfg.endpoint}/${r.id}`, body); else await post(cfg.endpoint, body); toast('Saved'); await draw(); });
  actions(root, 'click', {
    new: () => open(null), edit: (b) => open(rows.find((x) => x.id === Number(b.dataset.id))),
    del: guard(async (b) => { if (!confirm(`Delete this ${cfg.single}?`)) return; await del(`${cfg.endpoint}/${b.dataset.id}`); toast('Deleted'); await draw(); }),
  });
  return draw();
}
export async function website(main, ctx) {
  setTitle('Website Management'); loader(main);
  const S = await get('/api/admin/settings'); if (ctx.stale()) return;
  const t = (name, label, extra = {}) => field({ name, label, value: S[name] || '', ...extra });
  const m = (name, label) => field({ name, label, value: toMoneyInput(S[name]), attrs: { inputmode: 'decimal' } });
  show(main, html`${head('Website Management')}
  <form id="settings" class="card" novalidate><h2>Restaurant information &amp; content</h2><p class="muted">Everything customers see on the website. Replace the [Placeholder] texts with your real details.</p>
    <div class="form-grid">${t('restaurant_name', 'Restaurant name', { required: true })}${t('tagline', 'Tagline')}${t('hero_title', 'Homepage headline')}${t('currency_symbol', 'Currency symbol', { attrs: { maxlength: 5 } })}
      <div class="full">${t('hero_subtitle', 'Homepage intro text', { type: 'textarea', rows: 2 })}</div>
      <div class="full">${t('about_story', 'About - our story', { type: 'textarea', rows: 4 })}</div>${t('about_mission', 'Mission', { type: 'textarea', rows: 3 })}${t('about_vision', 'Vision', { type: 'textarea', rows: 3 })}
      ${t('about_values', 'Values (one per line)', { type: 'textarea', rows: 3 })}${t('quality_text', 'Food quality & service', { type: 'textarea', rows: 3 })}
      <div class="full">${t('why_choose', 'Why choose us (one per line: Title|Description)', { type: 'textarea', rows: 3 })}</div></div>
    <h3>Contact &amp; hours</h3><div class="form-grid">${t('phone', 'Phone')}${t('email', 'Email')}${t('address', 'Address')}${t('whatsapp', 'WhatsApp number (digits, with country code)', { hint: 'Example: 15551234567' })}
      ${t('map_url', 'Map link (https://…)')}${t('facebook', 'Facebook link')}${t('instagram', 'Instagram link')}${t('twitter', 'X / Twitter link')}<div class="full">${t('opening_hours', 'Opening hours (one per line)', { type: 'textarea', rows: 3 })}</div></div>
    <h3>Ordering &amp; reservations</h3><div class="form-grid">${m('delivery_fee_cents', 'Delivery fee')}${m('free_delivery_over_cents', 'Free delivery over (0 = never)')}${m('min_order_cents', 'Minimum order')}
      ${t('reservation_duration_min', 'Reservation length (minutes)', { type: 'number', value: S.reservation_duration_min, attrs: { min: 15 } })}${t('reservation_open', 'First reservation time (HH:MM)')}${t('reservation_close', 'Last reservation time (HH:MM)')}</div>
    <p class="form-error" data-form-error role="alert"></p><button class="btn" type="submit">Save website settings</button></form>
  <div class="stack"><div id="promos"></div><div id="testi"></div><div id="codes"></div><div id="tables"></div></div>`);
  handleForm(main.querySelector('#settings'), async (v) => {
    const body = { ...v };
    for (const k of MONEY_KEYS) { const c = parseMoney(v[k]); if (Number.isNaN(c)) throw new ApiError(422, 'Please correct the highlighted fields.', { [k]: 'Enter an amount like 3.00' }); body[k] = c; }
    body.reservation_duration_min = Number(v.reservation_duration_min);
    state.settings = await put('/api/admin/settings', body); toast('Website settings saved');
  });
  const chk = (r) => yesNo(r.active);
  crudBlock(main.querySelector('#promos'), { title: 'Promotions', single: 'promotion', endpoint: '/api/admin/promotions', empty: 'No promotions.',
    cols: [['Title', (r) => r.title], ['Code', (r) => r.code || '-'], ['Active', chk]],
    form: (r) => html`${field({ name: 'title', label: 'Title', required: true, value: r.title || '' })}${field({ name: 'description', label: 'Description', type: 'textarea', rows: 2, value: r.description || '' })}${field({ name: 'code', label: 'Discount code to show (optional)', value: r.code || '' })}${field({ name: 'active', label: 'Active', type: 'checkbox', value: r.active ?? 1 })}`, body: (v) => v });
  crudBlock(main.querySelector('#testi'), { title: 'Customer reviews (homepage)', single: 'review', endpoint: '/api/admin/testimonials', empty: 'No reviews.',
    cols: [['Name', (r) => r.name], ['Rating', (r) => r.rating + '/5'], ['Text', (r) => r.text], ['Active', chk]],
    form: (r) => html`${field({ name: 'name', label: 'Customer name', required: true, value: r.name || '' })}${field({ name: 'text', label: 'Review text', type: 'textarea', required: true, rows: 3, value: r.text || '' })}${field({ name: 'rating', label: 'Rating (1-5)', type: 'number', value: r.rating ?? 5, attrs: { min: 1, max: 5 } })}${field({ name: 'active', label: 'Show on homepage', type: 'checkbox', value: r.active ?? 1 })}`, body: (v) => ({ ...v, rating: Number(v.rating) }) });
  crudBlock(main.querySelector('#codes'), { title: 'Discount codes', single: 'discount code', endpoint: '/api/admin/discounts', empty: 'No discount codes.',
    cols: [['Code', (r) => r.code], ['Percent', (r) => r.percent + '%'], ['Min. order', (r) => money(r.min_subtotal_cents)], ['Expires', (r) => r.expires_on || 'Never'], ['Active', chk]],
    form: (r) => html`${field({ name: 'code', label: 'Code', required: true, value: r.code || '', attrs: { maxlength: 30 } })}${field({ name: 'percent', label: 'Percent off (1-100)', type: 'number', required: true, value: r.percent || 10, attrs: { min: 1, max: 100 } })}${field({ name: 'min_subtotal_cents', label: 'Minimum order amount', value: toMoneyInput(r.min_subtotal_cents || 0) })}${field({ name: 'expires_on', label: 'Expires on (optional)', type: 'date', value: r.expires_on || '' })}${field({ name: 'active', label: 'Active', type: 'checkbox', value: r.active ?? 1 })}`,
    body: (v) => { const c = parseMoney(v.min_subtotal_cents); if (Number.isNaN(c)) throw new ApiError(422, 'Please correct the highlighted fields.', { min_subtotal_cents: 'Enter an amount like 10.00' }); return { ...v, percent: Number(v.percent), min_subtotal_cents: c }; } });
  crudBlock(main.querySelector('#tables'), { title: 'Dining tables (for reservations)', single: 'table', endpoint: '/api/admin/tables', empty: 'No tables. Reservations need at least one table.',
    cols: [['Name', (r) => r.name], ['Seats', (r) => r.capacity], ['Active', chk]],
    form: (r) => html`${field({ name: 'name', label: 'Table name', required: true, value: r.name || '' })}${field({ name: 'capacity', label: 'Seats', type: 'number', required: true, value: r.capacity || 2, attrs: { min: 1, max: 50 } })}${field({ name: 'active', label: 'In use', type: 'checkbox', value: r.active ?? 1 })}`, body: (v) => ({ ...v, capacity: Number(v.capacity) }) });
}
