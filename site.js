// Customer-facing pages.
import {
  html, raw, get, post, put, state, cart, icon, money, actions, toast, field, handleForm, formValues, showFormErrors,
  foodImg, emojiFor, setTitle, lines, ApiError, statusBadge, fmtDateTime, fmtDate, todayISO, STATUS_LABELS,
} from './lib.js';

const show = (main, view) => { main.innerHTML = view.s; };
const pageHead = (title, sub) => html`<section class="page-head"><div class="container"><h1>${title}</h1>${sub ? html`<p>${sub}</p>` : ''}</div></section>`;
const cardCart = (id, name, disabled) => html`<button class="btn btn-sm" data-action="quick-add" data-id="${id}" data-name="${name}" ${disabled ? raw('disabled') : ''}>${icon('plus')} Add to Cart</button>`;

export function foodCard(f) {
  const off = !f.available;
  return html`<article class="food-card">
    <a class="thumb" href="#/menu/${f.id}" tabindex="-1" aria-hidden="true">${foodImg(f)}</a>
    <div class="food-body">
      <div class="badges"><span class="badge">${f.category_name}</span>${f.featured ? html`<span class="badge badge-featured">Featured</span>` : ''}${f.popular ? html`<span class="badge badge-popular">Popular</span>` : ''}${off ? html`<span class="badge badge-off">Unavailable</span>` : ''}</div>
      <h3><a href="#/menu/${f.id}">${f.name}</a></h3>
      <p>${f.description}</p>
      <div class="food-foot"><span class="price">${f.option_count ? 'From ' : ''}${money(f.price_cents)}</span>${cardCart(f.id, f.name, off)}</div>
    </div></article>`;
}
function wireQuickAdd(root) {
  actions(root, 'click', {
    'quick-add': (btn) => {
      cart.add({ foodId: Number(btn.dataset.id), name: btn.dataset.name, variationId: null, extraIds: [], quantity: 1, instructions: '' });
      toast(`${btn.dataset.name} added to your cart`);
    },
  });
}

// ------------------------------------------------------------------ Home
export async function home(main, ctx) {
  const d = await get('/api/home'); if (ctx.stale()) return;
  const S = d.settings; setTitle('Home');
  const why = lines(S.why_choose).map((l) => l.split('|')); const whyIcons = ['leaf', 'truck', 'calendar', 'star'];
  show(main, html`
  <section class="hero"><div class="container">
    <div><p class="eyebrow">${S.tagline}</p><h1>${S.hero_title}</h1><p class="lead">${S.hero_subtitle}</p>
      <div class="row"><a class="btn" href="#/menu">Order Now</a><a class="btn btn-ghost-light" href="#/menu">Explore Menu</a></div></div>
    <div class="hero-art" aria-hidden="true"><div class="hero-plate">🍽️</div></div>
  </div></section>

  ${d.categories.length ? html`<section class="section"><div class="container">
    <div class="section-head"><p class="eyebrow">Browse</p><h2>Popular Categories</h2></div>
    <div class="grid grid-3 cat-grid">${d.categories.map((c) => html`<a class="cat-card" href="#/menu?category=${c.slug}"><span class="em" aria-hidden="true">${emojiFor(c.name)}</span><strong>${c.name}</strong></a>`)}</div>
  </div></section>` : ''}

  <section class="section section-alt"><div class="container">
    <div class="section-head"><p class="eyebrow">Our picks</p><h2>Featured Dishes</h2></div>
    ${d.featured.length ? html`<div class="grid grid-food">${d.featured.map(foodCard)}</div><p class="center" ><a class="btn btn-outline" href="#/menu">View full menu</a></p>` : html`<div class="empty"><span class="em">🍽️</span>No featured dishes yet. Mark dishes as featured in the admin dashboard.</div>`}
  </div></section>

  ${d.promotions.length ? html`<section class="section"><div class="container">
    <div class="section-head"><p class="eyebrow">Offers</p><h2>Special Offers &amp; Promotions</h2></div>
    <div class="grid grid-3">${d.promotions.map((p) => html`<div class="promo"><h3>${p.title}</h3><p>${p.description}</p>${p.code ? html`<p>Use code <code>${p.code}</code> at checkout</p>` : ''}<a class="btn btn-light btn-sm" href="#/menu">Order now</a></div>`)}</div>
  </div></section>` : ''}

  <section class="section section-dark"><div class="container">
    <div class="section-head"><p class="eyebrow">Why us</p><h2>Why Choose ${S.restaurant_name}</h2></div>
    <div class="grid grid-3">${why.map(([t, x], i) => html`<div class="feature"><div class="ico">${icon(whyIcons[i % 4])}</div><h3>${t}</h3><p>${x || ''}</p></div>`)}</div>
  </div></section>

  ${d.testimonials.length ? html`<section class="section"><div class="container">
    <div class="section-head"><p class="eyebrow">Reviews</p><h2>What Customers Say</h2></div>
    <div class="grid grid-3">${d.testimonials.map((t) => html`<blockquote class="card quote"><div class="stars" aria-label="${t.rating} out of 5 stars">${Array.from({ length: t.rating }, () => icon('star'))}</div><p>${t.text}</p><footer>${t.name}</footer></blockquote>`)}</div>
  </div></section>` : ''}

  <section class="section section-alt"><div class="container grid grid-2">
    <div class="card"><h2>${icon('clock')} Opening Hours</h2><ul class="hours-list">${lines(S.opening_hours).map((l) => html`<li>${l}</li>`)}</ul></div>
    <div class="card"><h2>Get in Touch</h2><ul class="contact-list">
      <li>${icon('pin')}<span>${S.address}</span></li><li>${icon('phone')}<a href="tel:${(S.phone || '').replace(/[^+\d]/g, '')}">${S.phone}</a></li><li>${icon('mail')}<a href="mailto:${S.email}">${S.email}</a></li></ul>
      <p><a class="btn btn-outline" href="#/contact">Contact us</a> <a class="btn" href="#/reserve">Reserve a table</a></p></div>
  </div></section>`);
  wireQuickAdd(main);
}

// ------------------------------------------------------------------ About
export async function about(main) {
  const S = state.settings; setTitle('About Us');
  show(main, html`${pageHead('About Us', S.tagline)}
  <section class="section"><div class="container grid grid-2">
    <div><p class="eyebrow">Our story</p><h2>Who we are</h2><p>${S.about_story}</p><p>${S.quality_text}</p></div>
    <div class="hero-art" aria-hidden="true"><div class="hero-plate">👩‍🍳</div></div>
  </div></section>
  <section class="section section-alt"><div class="container grid grid-2">
    <div class="card"><h3>Our Mission</h3><p>${S.about_mission}</p></div><div class="card"><h3>Our Vision</h3><p>${S.about_vision}</p></div></div></section>
  <section class="section"><div class="container"><div class="section-head"><p class="eyebrow">What we stand for</p><h2>Our Values</h2></div>
    <div class="grid grid-3">${lines(S.about_values).map((v) => html`<div class="card feature"><div class="ico">${icon('check')}</div><h3>${v}</h3></div>`)}</div></div></section>`);
}

// ------------------------------------------------------------------ Menu
export async function menu(main, ctx) {
  setTitle('Menu');
  const cats = await get('/api/categories'); if (ctx.stale()) return;
  const f = { category: ctx.query.category || '', q: '', sort: 'popular' };
  show(main, html`${pageHead('Our Menu', 'Freshly prepared and available for delivery or pickup.')}
  <section class="section"><div class="container">
    <div class="toolbar">
      <div class="search"><label class="sr-only" for="menu-search" hidden>Search</label>${icon('search')}<input id="menu-search" type="search" placeholder="Search dishes…" aria-label="Search dishes" maxlength="60"></div>
      <select id="menu-sort" aria-label="Sort dishes"><option value="popular">Featured first</option><option value="name">Name A-Z</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option></select>
    </div>
    <div class="chips" role="group" aria-label="Categories" id="chips"></div>
    <div id="results" aria-live="polite"><div class="loader">Loading menu…</div></div>
  </div></section>`);
  const chips = main.querySelector('#chips'); const results = main.querySelector('#results');
  const drawChips = () => {
    chips.innerHTML = html`<button class="chip" data-action="cat" data-slug="" aria-pressed="${String(f.category === '')}">All</button>${cats.map((c) => html`<button class="chip" data-action="cat" data-slug="${c.slug}" aria-pressed="${String(f.category === c.slug)}">${c.name}</button>`)}`.s;
  };
  let seq = 0;
  async function load() {
    const my = ++seq;
    const qs = new URLSearchParams(); if (f.category) qs.set('category', f.category); if (f.q) qs.set('q', f.q); qs.set('sort', f.sort);
    try {
      const items = await get('/api/foods?' + qs); if (my !== seq || ctx.stale()) return;
      results.innerHTML = (items.length ? html`<div class="grid grid-food">${items.map(foodCard)}</div>` : html`<div class="empty"><span class="em">🔍</span><p>No dishes match your search.</p><button class="btn btn-outline" data-action="reset">Clear filters</button></div>`).s;
    } catch (e) { results.innerHTML = html`<div class="alert alert-error">${e.message}</div>`.s; }
  }
  drawChips(); load();
  let timer;
  main.querySelector('#menu-search').addEventListener('input', (e) => { clearTimeout(timer); timer = setTimeout(() => { f.q = e.target.value.trim(); load(); }, 250); });
  main.querySelector('#menu-sort').addEventListener('change', (e) => { f.sort = e.target.value; load(); });
  actions(main, 'click', {
    cat: (b) => { f.category = b.dataset.slug; drawChips(); load(); },
    reset: () => { f.category = ''; f.q = ''; main.querySelector('#menu-search').value = ''; drawChips(); load(); },
  });
  wireQuickAdd(main);
}

// ------------------------------------------------------------------ Food details
export async function foodDetail(main, ctx) {
  let food;
  try { food = await get('/api/foods/' + encodeURIComponent(ctx.params.id)); } catch (e) { if (e.status === 404) return notFound(main); throw e; }
  if (ctx.stale()) return;
  setTitle(food.name);
  let qty = 1;
  show(main, html`<section class="section"><div class="container">
    <p><a href="#/menu">&larr; Back to menu</a></p>
    <div class="detail">
      <div class="big">${foodImg(food)}</div>
      <form id="detail-form" novalidate>
        <div class="badges"><span class="badge">${food.category_name}</span>${food.featured ? html`<span class="badge badge-featured">Featured</span>` : ''}${food.popular ? html`<span class="badge badge-popular">Popular</span>` : ''}<span class="badge ${food.available ? '' : 'badge-off'}">${food.available ? 'Available' : 'Unavailable'}</span></div>
        <h1>${food.name}</h1><p class="muted">${food.description}</p>
        <p class="price" id="d-price"></p>
        ${food.variations.length ? html`<fieldset class="option-list" aria-label="Size or option">${food.variations.map((v, i) => html`<label><input type="radio" name="variation" value="${v.id}" ${i === 0 ? raw('checked') : ''}><span class="grow">${v.name}</span><span>${v.price_delta_cents ? (v.price_delta_cents > 0 ? '+' : '-') + money(Math.abs(v.price_delta_cents)) : 'Included'}</span></label>`)}</fieldset>` : ''}
        ${food.extras.length ? html`<h3>Extras</h3><div class="option-list">${food.extras.map((x) => html`<label><input type="checkbox" name="extra" value="${x.id}"><span class="grow">${x.name}</span><span>+${money(x.price_cents)}</span></label>`)}</div>` : ''}
        <div class="field"><label for="f-instr">Special instructions</label><textarea id="f-instr" name="instructions" rows="2" maxlength="200" placeholder="Allergies, no onions, extra sauce…"></textarea></div>
        <div class="row"><div class="qty" role="group" aria-label="Quantity"><button type="button" data-action="dec" aria-label="Decrease quantity">${icon('minus')}</button><output id="d-qty" aria-live="polite">1</output><button type="button" data-action="inc" aria-label="Increase quantity">${icon('plus')}</button></div>
        <button class="btn grow" type="submit" ${food.available ? '' : raw('disabled')}>${icon('cart')} <span id="d-btn">Add to Cart</span></button></div>
        ${food.available ? '' : html`<p class="form-error">This item is currently unavailable.</p>`}
        <p class="hint">Displayed price is an estimate; the final price is confirmed by the restaurant's server at checkout.</p>
      </form></div></div></section>`);
  const form = main.querySelector('#detail-form');
  const calc = () => {
    const vId = Number((form.elements.variation && form.elements.variation.value) || 0);
    let unit = food.price_cents + ((food.variations.find((v) => v.id === vId) || {}).price_delta_cents || 0);
    form.querySelectorAll('input[name=extra]:checked').forEach((c) => { unit += (food.extras.find((x) => x.id === Number(c.value)) || {}).price_cents || 0; });
    main.querySelector('#d-price').textContent = money(unit * qty);
    main.querySelector('#d-qty').textContent = qty;
  };
  form.addEventListener('change', calc); calc();
  actions(main, 'click', { inc: () => { qty = Math.min(50, qty + 1); calc(); }, dec: () => { qty = Math.max(1, qty - 1); calc(); } });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = form.elements.variation ? Number(form.elements.variation.value) : null;
    const extraIds = [...form.querySelectorAll('input[name=extra]:checked')].map((c) => Number(c.value));
    cart.add({ foodId: food.id, name: food.name, variationId: v, extraIds, quantity: qty, instructions: form.elements.instructions.value.trim().slice(0, 200) });
    toast(`${qty} × ${food.name} added to your cart`);
  });
}

// ------------------------------------------------------------------ Cart
const summary = (q) => html`<div class="summary">
  <div class="line"><span>Subtotal</span><span>${money(q.subtotal)}</span></div>
  ${q.orderType === 'delivery' ? html`<div class="line"><span>Delivery</span><span>${q.delivery ? money(q.delivery) : 'Free'}</span></div>` : ''}
  ${q.discount ? html`<div class="line discount"><span>Discount (${q.discountCode})</span><span>-${money(q.discount)}</span></div>` : ''}
  <div class="line total"><span>Total</span><span>${money(q.total)}</span></div></div>`;
const lineDesc = (l) => [l.variationName, ...l.extras.map((e) => '+ ' + e.name)].filter(Boolean).join(' · ');

export async function cartPage(main, ctx) {
  setTitle('Your Cart');
  show(main, html`${pageHead('Your Cart')}<section class="section"><div class="container" id="cart-root"><div class="loader">Loading cart…</div></div></section>`);
  const root = main.querySelector('#cart-root');
  async function refresh() {
    const items = cart.load();
    if (!items.length) { root.innerHTML = html`<div class="empty"><span class="em">🛒</span><p>Your cart is empty.</p><a class="btn" href="#/menu">Browse the menu</a></div>`.s; return; }
    let q;
    try { q = await post('/api/cart/quote', { items: cart.toApi(), orderType: state.orderType, discountCode: state.discountCode }); }
    catch (e) {
      if (ctx.stale()) return;
      root.innerHTML = html`<div class="alert alert-error">${e.message}</div>${items.map((it, i) => html`<div class="cart-item"><div></div><div><h3>${it.name || 'Item #' + it.foodId}</h3></div><div class="cart-actions"><button class="btn btn-sm btn-outline" data-action="remove" data-i="${i}">${icon('trash')} Remove</button></div></div>`)}`.s;
      return;
    }
    if (ctx.stale()) return;
    root.innerHTML = html`<div class="cart-layout">
      <div class="card"><h2>Items</h2>${q.lines.map((l, i) => html`<div class="cart-item">
        <div>${foodImg({ name: l.name, id: l.foodId, image_url: '', category_name: l.name })}</div>
        <div><h3>${l.name}</h3><p class="muted">${lineDesc(l)}${l.instructions ? html`<br><em>“${l.instructions}”</em>` : ''}</p><span class="price">${money(l.lineCents)}</span> <span class="muted">(${money(l.unitCents)} each)</span></div>
        <div class="cart-actions"><div class="qty" role="group" aria-label="Quantity for ${l.name}"><button data-action="dec" data-i="${i}" aria-label="Decrease quantity">${icon('minus')}</button><output>${l.quantity}</output><button data-action="inc" data-i="${i}" aria-label="Increase quantity">${icon('plus')}</button></div>
        <button class="btn btn-sm btn-outline" data-action="remove" data-i="${i}" aria-label="Remove ${l.name}">${icon('trash')}</button></div></div>`)}
      <p><a href="#/menu">&larr; Continue shopping</a></p></div>
      <aside class="card"><h2>Order Summary</h2>
        <div class="radio-cards"><label class="radio-card"><input type="radio" name="otype" value="delivery" ${q.orderType === 'delivery' ? raw('checked') : ''}> ${icon('truck')} Delivery</label><label class="radio-card"><input type="radio" name="otype" value="pickup" ${q.orderType === 'pickup' ? raw('checked') : ''}> ${icon('utensils')} Pickup</label></div>
        <form id="code-form" class="row"><label class="sr-only" for="code" hidden>Discount code</label><input id="code" name="code" class="grow" placeholder="Discount code" maxlength="30" value="${state.discountCode}"><button class="btn btn-dark btn-sm" type="submit">Apply</button></form>
        ${q.discountError ? html`<p class="field-error" role="alert">${q.discountError}</p>` : ''}
        ${summary(q)}
        ${q.belowMinimum ? html`<div class="alert alert-warn">The minimum order is ${money(q.minOrder)}.</div>` : ''}
        <p></p><a class="btn btn-block" href="#/checkout" ${q.belowMinimum ? raw('aria-disabled="true"') : ''}>Proceed to Checkout</a>
      </aside></div>`.s;
  }
  refresh();
  const change = async (fn) => { fn(); await refresh(); };
  actions(main, 'click', {
    inc: (b) => change(() => cart.setQty(Number(b.dataset.i), cart.load()[Number(b.dataset.i)].quantity + 1)),
    dec: (b) => change(() => cart.setQty(Number(b.dataset.i), cart.load()[Number(b.dataset.i)].quantity - 1)),
    remove: (b) => change(() => { cart.remove(Number(b.dataset.i)); toast('Item removed'); }),
  });
  main.addEventListener('change', (e) => { if (e.target.name === 'otype') { state.orderType = e.target.value; refresh(); } });
  main.addEventListener('submit', (e) => { if (e.target.id === 'code-form') { e.preventDefault(); state.discountCode = e.target.elements.code.value.trim(); refresh(); } });
  main.addEventListener('click', (e) => { const a = e.target.closest('a[aria-disabled=true]'); if (a) e.preventDefault(); });
}

// ------------------------------------------------------------------ Checkout
export async function checkout(main, ctx) {
  setTitle('Checkout');
  if (!cart.count()) { location.hash = '#/cart'; return; }
  const u = state.user || {};
  show(main, html`${pageHead('Checkout')}<section class="section"><div class="container"><div class="cart-layout">
    <form id="checkout-form" class="card" novalidate>
      <h2>Your Details</h2>
      <div class="radio-cards">
        <label class="radio-card"><input type="radio" name="orderType" value="delivery" ${state.orderType === 'delivery' ? raw('checked') : ''}> ${icon('truck')} Home Delivery</label>
        <label class="radio-card"><input type="radio" name="orderType" value="pickup" ${state.orderType === 'pickup' ? raw('checked') : ''}> ${icon('utensils')} Pickup / Takeaway</label></div>
      <div class="form-grid">
        ${field({ name: 'name', label: 'Full name', required: true, value: u.name || '', attrs: { autocomplete: 'name', maxlength: 80 } })}
        ${field({ name: 'phone', label: 'Phone number', type: 'tel', required: true, value: u.phone || '', attrs: { autocomplete: 'tel', maxlength: 25 } })}
        <div class="full">${field({ name: 'email', label: 'Email address', type: 'email', required: true, value: u.email || '', attrs: { autocomplete: 'email', maxlength: 120 } })}</div>
      </div>
      <div id="delivery-fields" class="form-grid">
        <div>${field({ name: 'address', label: 'Delivery address', required: true, attrs: { autocomplete: 'street-address', maxlength: 200 } })}</div>
        <div>${field({ name: 'city', label: 'City', required: true, attrs: { autocomplete: 'address-level2', maxlength: 80 } })}</div>
      </div>
      ${field({ name: 'notes', label: 'Order notes (optional)', type: 'textarea', rows: 2, attrs: { maxlength: 300 } })}
      <h3>Payment</h3>
      <div class="radio-cards"><label class="radio-card"><input type="radio" name="paymentMethod" value="cod" checked> Cash on Delivery / Pickup</label>
        <label class="radio-card disabled"><input type="radio" name="paymentMethod" value="online" disabled> Online payment (coming soon)</label></div>
      <p class="form-error" data-form-error role="alert"></p>
      <button class="btn btn-block" type="submit">Place Order</button>
    </form>
    <aside class="card" id="checkout-summary"><div class="loader">Calculating…</div></aside></div></div></section>`);
  const form = main.querySelector('#checkout-form'); const box = main.querySelector('#checkout-summary');
  const toggle = () => { main.querySelector('#delivery-fields').hidden = state.orderType !== 'delivery'; };
  let blocked = false;
  async function quote() {
    try {
      const q = await post('/api/cart/quote', { items: cart.toApi(), orderType: state.orderType, discountCode: state.discountCode });
      if (ctx.stale()) return; blocked = q.belowMinimum;
      box.innerHTML = html`<h2>Order Summary</h2>${q.lines.map((l) => html`<div class="summary"><div class="line"><span>${l.quantity} × ${l.name}${lineDesc(l) ? html`<br><small class="muted">${lineDesc(l)}</small>` : ''}</span><span>${money(l.lineCents)}</span></div></div>`)}<hr>${summary(q)}${q.discountError ? html`<p class="field-error" role="alert">${q.discountError}</p>` : ''}${q.belowMinimum ? html`<div class="alert alert-warn">The minimum order is ${money(q.minOrder)}.</div>` : ''}<p><a href="#/cart">&larr; Edit cart</a></p>`.s;
    } catch (e) { box.innerHTML = html`<div class="alert alert-error">${e.message}</div><a class="btn btn-outline" href="#/cart">Back to cart</a>`.s; blocked = true; }
  }
  toggle(); quote();
  form.addEventListener('change', (e) => { if (e.target.name === 'orderType') { state.orderType = e.target.value; toggle(); quote(); } });
  handleForm(form, async (v) => {
    if (blocked) throw new ApiError(422, 'Please fix the problems in your cart before placing the order.');
    const order = await post('/api/orders', { ...v, orderType: state.orderType, paymentMethod: 'cod', items: cart.toApi(), discountCode: state.discountCode });
    state.lastOrder = order; cart.clear(); state.discountCode = '';
    location.hash = '#/order-confirmation';
  });
}

export async function confirmation(main) {
  const o = state.lastOrder; if (!o) { location.hash = '#/track'; return; }
  setTitle('Order Confirmed');
  show(main, html`<section class="section"><div class="container auth-card" ><div class="card center">
    <div class="success-mark">${icon('check')}</div><h1>Thank you, ${o.customer_name.split(' ')[0]}!</h1>
    <p>Your order has been received. Order number:</p><p class="price" id="order-number">${o.order_number}</p>
    <p class="muted">Status: ${statusBadge(o.status)} · ${o.order_type === 'delivery' ? 'Home delivery' : 'Pickup'} · Pay with cash</p>
    <div class="summary left">${o.items.map((i) => html`<div class="line"><span>${i.quantity} × ${i.name}</span><span>${money(i.line_total_cents)}</span></div>`)}
      ${o.delivery_cents ? html`<div class="line"><span>Delivery</span><span>${money(o.delivery_cents)}</span></div>` : ''}
      ${o.discount_cents ? html`<div class="line discount"><span>Discount</span><span>-${money(o.discount_cents)}</span></div>` : ''}
      <div class="line total"><span>Total</span><span>${money(o.total_cents)}</span></div></div>
    <p class="hint">Keep your order number and the phone number you entered to track this order.</p>
    <p class="row"><a class="btn" href="#/track">Track order</a><a class="btn btn-outline" href="#/menu">Back to menu</a></p></div></div></section>`);
}

// ------------------------------------------------------------------ Track order
function trackView(o) {
  const flow = ['pending', 'confirmed', 'preparing', o.order_type === 'pickup' ? 'ready' : 'out_for_delivery', 'delivered'];
  const at = Object.fromEntries(o.events.map((e) => [e.status, e.created_at]));
  const cancelled = o.status === 'cancelled'; const cur = flow.indexOf(o.status);
  const steps = cancelled
    ? o.events.map((e, i) => html`<li class="${e.status === 'cancelled' ? 'bad' : 'done'}"><span class="dot"></span><strong>${STATUS_LABELS[e.status]}</strong><br><small>${fmtDateTime(e.created_at)}</small></li>`)
    : flow.map((s, i) => html`<li class="${i <= cur ? 'done' : ''} ${i === cur ? 'current' : ''}"><span class="dot"></span><strong>${STATUS_LABELS[s]}</strong>${at[s] ? html`<br><small>${fmtDateTime(at[s])}</small>` : ''}</li>`);
  return html`<div class="card"><div class="row row-between"><h2>Order ${o.order_number}</h2>${statusBadge(o.status)}</div>
    <p class="muted">Placed ${fmtDateTime(o.created_at)} · ${o.order_type === 'delivery' ? 'Home delivery' : 'Pickup'} · ${o.payment_method === 'cod' ? 'Cash' : 'Online'}</p>
    ${cancelled && o.cancel_reason ? html`<div class="alert alert-error">Reason: ${o.cancel_reason}</div>` : ''}
    <ol class="timeline">${steps}</ol>
    <div class="summary">${o.items.map((i) => html`<div class="line"><span>${i.quantity} × ${i.name}${i.variation_name ? ' (' + i.variation_name + ')' : ''}</span><span>${money(i.line_total_cents)}</span></div>`)}
      ${o.delivery_cents ? html`<div class="line"><span>Delivery</span><span>${money(o.delivery_cents)}</span></div>` : ''}${o.discount_cents ? html`<div class="line discount"><span>Discount</span><span>-${money(o.discount_cents)}</span></div>` : ''}
      <div class="line total"><span>Total</span><span>${money(o.total_cents)}</span></div></div></div>`;
}
export async function track(main) {
  setTitle('Track Order');
  show(main, html`${pageHead('Track Your Order', 'Enter your order number and the phone number used for the order.')}<section class="section"><div class="container auth-card">
    <form id="track-form" class="card" novalidate>
      ${field({ name: 'orderNumber', label: 'Order number', required: true, value: state.lastOrder ? state.lastOrder.order_number : '', attrs: { placeholder: 'ORD-250101-AB12C', maxlength: 40 } })}
      ${field({ name: 'phone', label: 'Phone number', type: 'tel', required: true, value: (state.user && state.user.phone) || '', attrs: { maxlength: 25 } })}
      <p class="form-error" data-form-error role="alert"></p><button class="btn btn-block" type="submit">Track order</button></form>
    <div id="track-result" class="stack" aria-live="polite"></div></div></section>`);
  const out = main.querySelector('#track-result');
  handleForm(main.querySelector('#track-form'), async (v) => { const o = await post('/api/orders/track', v); out.innerHTML = trackView(o).s; });
}

// ------------------------------------------------------------------ Reservations
const resCard = (r) => html`<div class="card"><div class="row row-between"><h3>${r.ref}</h3>${statusBadge(r.status)}</div>
  <p>${fmtDate(r.res_date)} at ${r.res_time} · ${r.guests} guest${r.guests === 1 ? '' : 's'}</p>
  ${r.status === 'pending' ? html`<p class="alert alert-warn">Not confirmed yet. The restaurant must approve your request first.</p>` : ''}
  ${r.status === 'approved' ? html`<p class="alert alert-success">Your table is confirmed.</p>` : ''}
  ${r.status === 'rejected' ? html`<p class="alert alert-error">Sorry, this request could not be accepted. Please try another time.</p>` : ''}</div>`;
export async function reserve(main) {
  setTitle('Reserve a Table'); const S = state.settings; const u = state.user || {};
  show(main, html`${pageHead('Reserve a Table', `Reservations are accepted between ${S.reservation_open} and ${S.reservation_close}.`)}<section class="section"><div class="container grid grid-2">
    <form id="res-form" class="card" novalidate><h2>Request a table</h2>
      <div class="form-grid">
        ${field({ name: 'name', label: 'Full name', required: true, value: u.name || '', attrs: { maxlength: 80 } })}
        ${field({ name: 'phone', label: 'Phone number', type: 'tel', required: true, value: u.phone || '', attrs: { maxlength: 25 } })}
        <div class="full">${field({ name: 'email', label: 'Email', type: 'email', required: true, value: u.email || '', attrs: { maxlength: 120 } })}</div>
        ${field({ name: 'date', label: 'Date', type: 'date', required: true, attrs: { min: todayISO() } })}
        ${field({ name: 'time', label: 'Time', type: 'time', required: true, value: '19:00' })}
        ${field({ name: 'guests', label: 'Guests', type: 'number', required: true, value: 2, attrs: { min: 1, max: 50 } })}
      </div>
      ${field({ name: 'requests', label: 'Special requests (optional)', type: 'textarea', rows: 2, attrs: { maxlength: 300 } })}
      <p class="form-error" data-form-error role="alert"></p><button class="btn btn-block" type="submit">Request reservation</button>
      <div id="res-result"></div></form>
    <div class="stack"><form id="lookup-form" class="card" novalidate><h2>Check a reservation</h2>
      ${field({ name: 'ref', label: 'Reference', required: true, idp: 'lk-', attrs: { placeholder: 'RES-AB12CD', maxlength: 20 } })}
      ${field({ name: 'phone', label: 'Phone number', type: 'tel', required: true, idp: 'lk-', attrs: { maxlength: 25 } })}
      <p class="form-error" data-form-error role="alert"></p><button class="btn btn-dark" type="submit">Check status</button><div id="lookup-result" class="stack"></div></form>
      <div class="alert alert-info">A reservation is only confirmed once the restaurant has approved it. You will see its status here and in your account.</div></div>
  </div></section>`);
  handleForm(main.querySelector('#res-form'), async (v, form) => {
    const r = await post('/api/reservations', { ...v, guests: Number(v.guests) });
    main.querySelector('#res-result').innerHTML = html`<div class="alert alert-success"><strong>Request received.</strong> Your reference is <strong id="res-ref">${r.ref}</strong>. Status: pending approval.</div>`.s;
    form.reset(); toast('Reservation request sent');
  });
  handleForm(main.querySelector('#lookup-form'), async (v) => { main.querySelector('#lookup-result').innerHTML = resCard(await post('/api/reservations/lookup', v)).s; });
}

// ------------------------------------------------------------------ Contact
export async function contact(main) {
  setTitle('Contact'); const S = state.settings;
  show(main, html`${pageHead('Contact Us', 'Questions, feedback or special requests? Send us a message.')}<section class="section"><div class="container grid grid-2">
    <div class="card"><h2>Visit or call</h2><ul class="contact-list">
      <li>${icon('pin')}<span>${S.address}${S.map_url ? html`<br><a href="${S.map_url}" target="_blank" rel="noopener noreferrer">Open in maps</a>` : ''}</span></li>
      <li>${icon('phone')}<a href="tel:${(S.phone || '').replace(/[^+\d]/g, '')}">${S.phone}</a></li><li>${icon('mail')}<a href="mailto:${S.email}">${S.email}</a></li>
      <li>${icon('clock')}<span>${lines(S.opening_hours).map((l) => html`${l}<br>`)}</span></li></ul>
      <p class="row">${S.whatsapp ? html`<a class="btn btn-ok" href="https://wa.me/${S.whatsapp}" target="_blank" rel="noopener noreferrer">WhatsApp us</a>` : ''}
      ${['facebook', 'instagram', 'twitter'].filter((k) => S[k]).map((k) => html`<a class="btn btn-outline btn-sm" href="${S[k]}" target="_blank" rel="noopener noreferrer">${k === 'twitter' ? 'X / Twitter' : k[0].toUpperCase() + k.slice(1)}</a>`)}</p></div>
    <form id="contact-form" class="card" novalidate><h2>Send a message</h2>
      <div class="form-grid">${field({ name: 'name', label: 'Name', required: true, attrs: { maxlength: 80 } })}${field({ name: 'email', label: 'Email', type: 'email', required: true, attrs: { maxlength: 120 } })}
        ${field({ name: 'phone', label: 'Phone (optional)', type: 'tel', attrs: { maxlength: 25 } })}${field({ name: 'subject', label: 'Subject', attrs: { maxlength: 120 } })}</div>
      ${field({ name: 'message', label: 'Message', type: 'textarea', required: true, rows: 5, attrs: { maxlength: 2000 } })}
      <p class="form-error" data-form-error role="alert"></p><button class="btn btn-block" type="submit">Send message</button></form></div></section>`);
  handleForm(main.querySelector('#contact-form'), async (v, form) => { await post('/api/contact', v); form.reset(); toast('Thanks! Your message was sent.'); });
}

// ------------------------------------------------------------------ Auth
const afterLogin = (query, user) => { const n = query.next; location.hash = n && n.startsWith('/') ? '#' + n : user.role === 'admin' ? '#/admin' : '#/account'; };
export async function login(main, ctx) {
  if (state.user) return afterLogin(ctx.query, state.user);
  setTitle('Sign in');
  show(main, html`${pageHead('Sign in')}<section class="section"><div class="container auth-card"><form id="login-form" class="card" novalidate>
    ${field({ name: 'email', label: 'Email', type: 'email', required: true, attrs: { autocomplete: 'username' } })}
    ${field({ name: 'password', label: 'Password', type: 'password', required: true, attrs: { autocomplete: 'current-password' } })}
    <p class="form-error" data-form-error role="alert"></p><button class="btn btn-block" type="submit">Sign in</button>
    <p class="center">New here? <a href="#/register">Create an account</a></p></form></div></section>`);
  handleForm(main.querySelector('#login-form'), async (v) => { const r = await post('/api/auth/login', v); state.user = r.user; toast(`Welcome back, ${r.user.name.split(' ')[0]}!`); afterLogin(ctx.query, r.user); });
}
export async function register(main, ctx) {
  if (state.user) return afterLogin(ctx.query, state.user);
  setTitle('Create account');
  show(main, html`${pageHead('Create your account')}<section class="section"><div class="container auth-card"><form id="reg-form" class="card" novalidate>
    ${field({ name: 'name', label: 'Full name', required: true, attrs: { autocomplete: 'name', maxlength: 80 } })}
    ${field({ name: 'email', label: 'Email', type: 'email', required: true, attrs: { autocomplete: 'email' } })}
    ${field({ name: 'phone', label: 'Phone number', type: 'tel', required: true, attrs: { autocomplete: 'tel' } })}
    ${field({ name: 'password', label: 'Password', type: 'password', required: true, hint: 'At least 8 characters with a letter and a number.', attrs: { autocomplete: 'new-password' } })}
    <p class="form-error" data-form-error role="alert"></p><button class="btn btn-block" type="submit">Create account</button>
    <p class="center">Already registered? <a href="#/login">Sign in</a></p></form></div></section>`);
  handleForm(main.querySelector('#reg-form'), async (v) => { const r = await post('/api/auth/register', v); state.user = r.user; toast('Account created. Welcome!'); afterLogin(ctx.query, r.user); });
}

// ------------------------------------------------------------------ Customer account
export async function account(main, ctx) {
  const tab = ctx.params.tab || 'profile'; setTitle('My Account');
  const tabs = [['profile', 'Profile'], ['orders', 'Orders'], ['reservations', 'Reservations'], ['password', 'Password']];
  const u = state.user;
  let body;
  if (tab === 'profile') {
    body = html`<form id="profile-form" class="card" novalidate><h2>Personal information</h2>
      ${field({ name: 'name', label: 'Full name', required: true, value: u.name, attrs: { maxlength: 80 } })}
      ${field({ name: 'phone', label: 'Phone number', type: 'tel', required: true, value: u.phone, attrs: { maxlength: 25 } })}
      <div class="field"><label>Email</label><input value="${u.email}" disabled></div>
      <p class="form-error" data-form-error role="alert"></p><button class="btn" type="submit">Save changes</button></form>`;
  } else if (tab === 'password') {
    body = html`<form id="pw-form" class="card" novalidate><h2>Change password</h2>
      ${field({ name: 'current', label: 'Current password', type: 'password', required: true, attrs: { autocomplete: 'current-password' } })}
      ${field({ name: 'password', label: 'New password', type: 'password', required: true, hint: 'At least 8 characters with a letter and a number.', attrs: { autocomplete: 'new-password' } })}
      <p class="form-error" data-form-error role="alert"></p><button class="btn" type="submit">Update password</button></form>`;
  } else if (tab === 'orders') {
    const orders = await get('/api/account/orders'); if (ctx.stale()) return;
    const active = orders.filter((o) => !['delivered', 'cancelled'].includes(o.status));
    const card = (o) => html`<div class="card"><div class="row row-between"><h3>${o.order_number}</h3>${statusBadge(o.status)}</div>
      <p class="muted">${fmtDateTime(o.created_at)} · ${o.order_type === 'delivery' ? 'Delivery' : 'Pickup'} · ${money(o.total_cents)}</p>
      <p>${o.items.map((i) => `${i.quantity} × ${i.name}`).join(', ')}</p>
      ${['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(o.status) ? html`<details><summary>Track progress</summary>${trackView(o)}</details>` : ''}
      ${o.status === 'pending' ? html`<button class="btn btn-sm btn-outline" data-action="cancel-order" data-id="${o.id}">Cancel order</button>` : ''}</div>`;
    body = html`${active.length ? html`<h2>Current orders</h2><div class="stack">${active.map(card)}</div>` : ''}
      <h2>Order history</h2>${orders.length ? html`<div class="stack">${orders.filter((o) => !active.includes(o)).map(card)}</div>` : html`<div class="empty"><span class="em">🧾</span>No orders yet. <a href="#/menu">Browse the menu</a></div>`}`;
  } else if (tab === 'reservations') {
    const rs = await get('/api/account/reservations'); if (ctx.stale()) return;
    body = html`<h2>Your reservations</h2>${rs.length ? html`<div class="stack">${rs.map((r) => html`${resCard(r)}${['pending', 'approved'].includes(r.status) ? html`<button class="btn btn-sm btn-outline" data-action="cancel-res" data-id="${r.id}">Cancel ${r.ref}</button>` : ''}`)}</div>` : html`<div class="empty"><span class="em">📅</span>No reservations yet. <a href="#/reserve">Reserve a table</a></div>`}`;
  } else return notFound(main);
  show(main, html`${pageHead('My Account', `Signed in as ${u.email}`)}<section class="section"><div class="container">
    <nav class="tabs" aria-label="Account sections">${tabs.map(([k, l]) => html`<a href="#/account/${k}" ${k === tab ? raw('aria-current="page"') : ''}>${l}</a>`)}</nav>${body}</div></section>`);
  const pf = main.querySelector('#profile-form'); if (pf) handleForm(pf, async (v) => { state.user = (await put('/api/account/profile', v)).user; toast('Profile saved'); });
  const pw = main.querySelector('#pw-form'); if (pw) handleForm(pw, async (v, f) => { await post('/api/account/password', v); f.reset(); toast('Password updated'); });
  actions(main, 'click', {
    'cancel-order': async (b) => { if (!confirm('Cancel this order?')) return; try { await post(`/api/account/orders/${b.dataset.id}/cancel`); toast('Order cancelled'); } catch (e) { toast(e.message, 'error'); } window.dispatchEvent(new Event('hashchange')); },
    'cancel-res': async (b) => { if (!confirm('Cancel this reservation?')) return; try { await post(`/api/account/reservations/${b.dataset.id}/cancel`); toast('Reservation cancelled'); } catch (e) { toast(e.message, 'error'); } window.dispatchEvent(new Event('hashchange')); },
  });
}

export function notFound(main) {
  setTitle('Page not found');
  show(main, html`<section class="section"><div class="container empty"><span class="em">🍽️</span><h1>Page not found</h1><p>The page you are looking for does not exist.</p><a class="btn" href="#/">Back to home</a></div></section>`);
}
