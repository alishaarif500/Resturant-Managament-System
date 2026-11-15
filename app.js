import { html, raw, get, post, state, cart, icon, actions, toast, lines, setTitle } from './lib.js';
import * as site from './site.js';
import * as admin from './admin.js';

const app = document.getElementById('app');
let navToken = 0;

// pattern, page function, auth requirement, layout
const ROUTES = [
  ['/', site.home], ['/about', site.about], ['/menu', site.menu], ['/menu/:id', site.foodDetail], ['/cart', site.cartPage],
  ['/checkout', site.checkout], ['/order-confirmation', site.confirmation], ['/track', site.track], ['/reserve', site.reserve],
  ['/contact', site.contact], ['/login', site.login], ['/register', site.register],
  ['/account', site.account, 'user'], ['/account/:tab', site.account, 'user'],
  ['/admin', admin.dashboard, 'admin', 'admin'], ['/admin/foods', admin.foods, 'admin', 'admin'],
  ['/admin/categories', admin.categories, 'admin', 'admin'], ['/admin/orders', admin.orders, 'admin', 'admin'],
  ['/admin/orders/:id', admin.orderDetail, 'admin', 'admin'], ['/admin/customers', admin.customers, 'admin', 'admin'],
  ['/admin/customers/:id', admin.customerDetail, 'admin', 'admin'], ['/admin/reservations', admin.reservations, 'admin', 'admin'],
  ['/admin/reports', admin.reports, 'admin', 'admin'], ['/admin/website', admin.website, 'admin', 'admin'],
  ['/admin/messages', admin.messages, 'admin', 'admin'],
];

function parseHash() {
  const [p, q] = (location.hash.slice(1) || '/').split('?');
  return { path: p.replace(/\/+$/, '') || '/', query: Object.fromEntries(new URLSearchParams(q || '')) };
}
function match(path) {
  const segs = path.split('/');
  for (const [pattern, page, auth, layout] of ROUTES) {
    const ps = pattern.split('/');
    if (ps.length !== segs.length) continue;
    const params = {};
    if (ps.every((p, i) => (p.startsWith(':') ? ((params[p.slice(1)] = decodeURIComponent(segs[i])), true) : p === segs[i]))) return { page, auth, layout: layout || 'site', params };
  }
  return null;
}

const NAV = [['/', 'Home'], ['/menu', 'Menu'], ['/about', 'About'], ['/reserve', 'Reserve'], ['/track', 'Track Order'], ['/contact', 'Contact']];
const isActive = (path, href) => (href === '/' ? path === '/' : path === href || path.startsWith(href + '/'));

function siteShell(path) {
  const S = state.settings; const u = state.user;
  const social = [['facebook', 'Facebook'], ['instagram', 'Instagram'], ['twitter', 'X / Twitter']].filter(([k]) => S[k]);
  return html`
  <header class="site-header"><div class="container bar">
    <a class="brand" href="#/"><span class="brand-mark">${icon('utensils')}</span><span class="name">${S.restaurant_name}</span></a>
    <nav id="site-nav" class="nav" aria-label="Main">
      ${NAV.map(([h, l]) => html`<a href="#${h}" ${isActive(path, h) ? raw('aria-current="page"') : ''}>${l}</a>`)}
      <div class="nav-tools">
        ${u ? html`${u.role === 'admin' ? html`<a href="#/admin">Admin</a>` : ''}<a href="#/account" ${isActive(path, '/account') ? raw('aria-current="page"') : ''}>${icon('user')} Account</a><a href="#/" data-action="logout">Sign out</a>`
    : html`<a href="#/login" ${path === '/login' ? raw('aria-current="page"') : ''}>Sign in</a><a href="#/register">Register</a>`}
      </div>
    </nav>
    <a class="icon-btn cart-link" href="#/cart" aria-label="Shopping cart">${icon('cart')}<span class="cart-badge" data-cart-badge ${cart.count() ? '' : raw('hidden')}>${cart.count()}</span></a>
    <button class="icon-btn nav-toggle" data-action="toggle-nav" aria-label="Toggle menu" aria-expanded="false" aria-controls="site-nav">${icon('menu')}</button>
  </div></header>
  <main id="main" tabindex="-1"><div class="loader" role="status">Loading…</div></main>
  <footer class="site-footer"><div class="container">
    <div class="footer-grid">
      <div><h3>${S.restaurant_name}</h3><p>${S.tagline}</p>${social.length ? html`<div class="social">${social.map(([k, l]) => html`<a href="${S[k]}" target="_blank" rel="noopener noreferrer">${l}</a>`)}</div>` : ''}</div>
      <div><h3>Explore</h3><ul class="footer-links">${NAV.map(([h, l]) => html`<li><a href="#${h}">${l}</a></li>`)}<li><a href="#/cart">Cart</a></li></ul></div>
      <div><h3>Opening hours</h3><ul class="footer-links">${lines(S.opening_hours).map((l) => html`<li>${l}</li>`)}</ul></div>
      <div><h3>Contact</h3><ul class="footer-links"><li>${S.address}</li><li><a href="tel:${(S.phone || '').replace(/[^+\d]/g, '')}">${S.phone}</a></li><li><a href="mailto:${S.email}">${S.email}</a></li></ul></div>
    </div>
    <div class="footer-bottom"><span>&copy; ${new Date().getFullYear()} ${S.restaurant_name}. All rights reserved.</span><a href="#/login">Staff sign in</a></div>
  </div></footer>`;
}

const ADMIN_NAV = [['/admin', 'Dashboard'], ['/admin/orders', 'Orders'], ['/admin/foods', 'Food Items'], ['/admin/categories', 'Categories'], ['/admin/reservations', 'Reservations'], ['/admin/customers', 'Customers'], ['/admin/reports', 'Sales & Reports'], ['/admin/messages', 'Messages'], ['/admin/website', 'Website']];
function adminShell(path) {
  return html`
  <div class="admin-shell">
    <aside class="admin-side">
      <a class="brand" href="#/admin"><span class="brand-mark">${icon('utensils')}</span><span class="name">Admin</span></a>
      <nav class="admin-nav" aria-label="Admin">
        ${ADMIN_NAV.map(([h, l]) => html`<a href="#${h}" ${(h === '/admin' ? path === '/admin' : isActive(path, h)) ? raw('aria-current="page"') : ''}>${l}</a>`)}
        <a href="#/">View website</a><a href="#/" data-action="logout">Sign out</a>
      </nav>
    </aside>
    <main id="main" class="admin-main" tabindex="-1"><div class="loader" role="status">Loading…</div></main>
  </div>`;
}

async function render() {
  const token = ++navToken;
  const { path, query } = parseHash();
  const route = match(path) || { page: site.notFound, layout: 'site', params: {} };
  const next = encodeURIComponent(location.hash.slice(1) || '/');
  if (route.auth && !state.user) { location.hash = `#/login?next=${next}`; return; }
  if (route.auth === 'admin' && state.user.role !== 'admin') { app.innerHTML = siteShell('/').s; document.getElementById('main').innerHTML = html`<div class="container section"><div class="alert alert-error">Administrator access is required for this page.</div></div>`.s; return; }
  app.innerHTML = (route.layout === 'admin' ? adminShell(path) : siteShell(path)).s;
  const main = document.getElementById('main');
  try {
    await route.page(main, { params: route.params, query, path, stale: () => token !== navToken });
  } catch (err) {
    if (token !== navToken) return;
    console.error(err);
    main.innerHTML = html`<div class="container section"><div class="alert alert-error">${err.message || 'Something went wrong.'}</div><p><a class="btn btn-outline" href="#${path}">Try again</a></p></div>`.s;
  }
  if (token === navToken) { window.scrollTo(0, 0); }
}

actions(app, 'click', {
  'toggle-nav': (btn) => { const nav = document.getElementById('site-nav'); const open = nav.classList.toggle('open'); btn.setAttribute('aria-expanded', String(open)); },
  logout: async (_t, e) => {
    e.preventDefault();
    try { await post('/api/auth/logout'); } catch { /* ignore */ }
    state.user = null; toast('You have been signed out.');
    if (location.hash === '#/') render(); else location.hash = '#/';
  },
});
app.addEventListener('click', (e) => { const n = document.getElementById('site-nav'); if (n && e.target.closest('#site-nav a')) { n.classList.remove('open'); } });
window.addEventListener('hashchange', render);
window.addEventListener('cart-changed', () => {
  document.querySelectorAll('[data-cart-badge]').forEach((b) => { const c = cart.count(); b.textContent = c; b.hidden = !c; });
});

async function boot() {
  try {
    const [settings, me] = await Promise.all([get('/api/settings'), get('/api/auth/me')]);
    state.settings = settings; state.user = me.user;
    document.getElementById('meta-desc').content = `${settings.restaurant_name} - ${settings.tagline}. Order online, reserve a table and explore the menu.`;
    setTitle('Welcome');
    await render();
  } catch (err) {
    app.innerHTML = html`<div class="container section"><div class="alert alert-error">${err.message}</div><button class="btn" data-action="reload">Retry</button></div>`.s;
    actions(app, 'click', { reload: () => location.reload() });
  }
}
boot();
