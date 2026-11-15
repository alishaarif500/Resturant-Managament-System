// Shared helpers: safe HTML templating, API client, cart, formatting.
export class Raw { constructor(s) { this.s = s; } }
export const raw = (s) => new Raw(String(s));
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);
const part = (v) => (v instanceof Raw ? v.s : Array.isArray(v) ? v.map(part).join('') : v === null || v === undefined || v === false ? '' : esc(v));
/** Tagged template: every interpolated value is HTML-escaped unless it is already html`` output. */
export function html(strings, ...vals) {
  let out = strings[0];
  for (let i = 0; i < vals.length; i++) out += part(vals[i]) + strings[i + 1];
  return new Raw(out);
}

export const state = { user: null, settings: {}, lastOrder: null, orderType: 'delivery', discountCode: '' };

export class ApiError extends Error {
  constructor(status, message, fields) { super(message); this.status = status; this.fields = fields || null; }
}
export async function api(method, url, body) {
  let res;
  try {
    res = await fetch(url, {
      method, credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch { throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.'); }
  let json;
  try { json = await res.json(); } catch { throw new ApiError(res.status, 'Unexpected response from the server.'); }
  if (!json.ok) throw new ApiError(res.status, json.error.message, json.error.fields);
  return json.data;
}
export const get = (u) => api('GET', u);
export const post = (u, b = {}) => api('POST', u, b);
export const put = (u, b = {}) => api('PUT', u, b);
export const patch = (u, b = {}) => api('PATCH', u, b);
export const del = (u) => api('DELETE', u);

export const money = (cents) => `${state.settings.currency_symbol || '$'}${(Number(cents || 0) / 100).toFixed(2)}`;
// Accepts "12", "12.5", "12.50", "+1.5", "-3" (optionally with a currency symbol or thousands commas); anything else is NaN.
export const parseMoney = (s) => {
  const t = String(s).replace(/[\s,$€£]|Rs\.?/g, '');
  return /^[+-]?\d+(\.\d{1,2})?$/.test(t) ? Math.round(Number(t) * 100) : NaN;
};
export const toMoneyInput = (cents) => (Number(cents || 0) / 100).toFixed(2);
export const fmtDateTime = (s) => { const d = new Date(String(s).replace(' ', 'T') + 'Z'); return Number.isNaN(d.getTime()) ? s : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }); };
export const fmtDate = (s) => { const d = new Date(String(s).slice(0, 10) + 'T00:00:00'); return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString([], { dateStyle: 'medium' }); };
export const todayISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

export const STATUS_LABELS = {
  pending: 'Pending', confirmed: 'Confirmed', preparing: 'Preparing', ready: 'Ready for Pickup',
  out_for_delivery: 'Out for Delivery', delivered: 'Delivered', cancelled: 'Cancelled',
  approved: 'Approved', rejected: 'Rejected', completed: 'Completed',
};
export const statusBadge = (s) => html`<span class="status status-${s}">${STATUS_LABELS[s] || s}</span>`;

// ---- icons (Lucide-style inline SVG, no external requests) ----
const ICONS = {
  cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  menu: '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  minus: '<path d="M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
};
export const icon = (name, cls = '') => raw(`<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`);

// ---- food images: real image if set, otherwise a generated placeholder (never a broken image) ----
const PALETTES = [['#c2531b', '#e8a15b'], ['#7a3b1e', '#c98b4f'], ['#3b5b3a', '#9bb86c'], ['#8a2d2d', '#d98a6a'], ['#4b3a6b', '#b79bd1'], ['#2f5d6b', '#8ec3cf']];
const EMOJI = [[/burger/i, '🍔'], [/pizza/i, '🍕'], [/fast/i, '🍟'], [/sand/i, '🥪'], [/rice|biryani/i, '🍛'], [/bbq|grill/i, '🍖'], [/dessert|cake|sweet/i, '🍰'], [/bever|drink|juice|coffee/i, '🥤']];
export const emojiFor = (label = '') => (EMOJI.find(([rx]) => rx.test(label)) || [0, '🍽️'])[1];
export function placeholderImage(label = '', seed = 0) {
  const [a, b] = PALETTES[Math.abs(Number(seed) || 0) % PALETTES.length];
  const emoji = emojiFor(label);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="400" height="300" fill="url(#g)"/><circle cx="330" cy="40" r="90" fill="#fff" opacity=".08"/><circle cx="50" cy="270" r="110" fill="#fff" opacity=".08"/><text x="200" y="185" font-size="110" text-anchor="middle">${emoji}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
export function foodImg(f, cls = '') {
  const fallback = placeholderImage(f.category_name || f.name, f.category_id || f.id);
  return html`<img class="${cls}" src="${f.image_url || fallback}" data-fallback="${fallback}" alt="${f.name}" loading="lazy" width="400" height="300">`;
}
// Swap any image that fails to load for its placeholder (CSP forbids inline onerror handlers).
document.addEventListener('error', (e) => {
  const t = e.target;
  if (t && t.tagName === 'IMG' && t.dataset.fallback && t.src !== t.dataset.fallback) t.src = t.dataset.fallback;
}, true);

// ---- toasts ----
export function toast(message, type = 'success') {
  const box = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.textContent = message;
  box.appendChild(el);
  setTimeout(() => el.remove(), type === 'error' ? 6000 : 3500);
}

// ---- cart (localStorage, with in-memory fallback) ----
const CART_KEY = 'rms_cart_v1';
let memCart = [];
const clean = (a) => (Array.isArray(a) ? a : []).filter((i) => i && Number.isInteger(i.foodId) && Number.isInteger(i.quantity) && i.quantity >= 1 && i.quantity <= 50).map((i) => ({
  foodId: i.foodId, name: String(i.name || '').slice(0, 80), variationId: Number.isInteger(i.variationId) ? i.variationId : null,
  extraIds: Array.isArray(i.extraIds) ? i.extraIds.filter(Number.isInteger) : [], quantity: i.quantity, instructions: String(i.instructions || '').slice(0, 200),
}));
export const cart = {
  load() { try { const raw = localStorage.getItem(CART_KEY); return raw ? clean(JSON.parse(raw)) : []; } catch { return clean(memCart); } },
  save(items) { memCart = items; try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch { /* storage blocked: memory only */ } window.dispatchEvent(new Event('cart-changed')); },
  add(line) {
    const items = this.load();
    const key = (i) => [i.foodId, i.variationId, [...i.extraIds].sort().join(','), i.instructions].join('|');
    const found = items.find((i) => key(i) === key(line));
    if (found) found.quantity = Math.min(50, found.quantity + line.quantity); else items.push(line);
    this.save(items);
  },
  setQty(index, q) { const items = this.load(); if (!items[index]) return; items[index].quantity = Math.max(1, Math.min(50, q)); this.save(items); },
  remove(index) { const items = this.load(); items.splice(index, 1); this.save(items); },
  clear() { this.save([]); },
  count() { return this.load().reduce((s, i) => s + i.quantity, 0); },
  toApi() { return this.load().map(({ foodId, variationId, extraIds, quantity, instructions }) => ({ foodId, variationId, extraIds, quantity, instructions })); },
};

// ---- forms ----
export function field({ name, label, type = 'text', value = '', required = false, options = null, hint = '', attrs = {}, rows = 3, idp = 'f-' }) {
  const id = idp + name;
  const a = Object.entries(attrs).map(([k, v]) => `${esc(k)}="${esc(v)}"`).join(' ');
  let control;
  if (type === 'textarea') control = html`<textarea id="${id}" name="${name}" rows="${rows}" ${raw(a)} ${required ? raw('required') : ''}>${value}</textarea>`;
  else if (type === 'select') control = html`<select id="${id}" name="${name}" ${raw(a)}>${options.map((o) => html`<option value="${o.value}" ${String(o.value) === String(value) ? raw('selected') : ''}>${o.label}</option>`)}</select>`;
  else if (type === 'checkbox') return html`<div class="field field-check"><label><input type="checkbox" name="${name}" ${value ? raw('checked') : ''} ${raw(a)}> <span>${label}</span></label></div>`;
  else control = html`<input id="${id}" name="${name}" type="${type}" value="${value}" ${raw(a)} ${required ? raw('required') : ''}>`;
  return html`<div class="field"><label for="${id}">${label}${required ? html` <span class="req" aria-hidden="true">*</span>` : ''}</label>${control}${hint ? html`<p class="hint">${hint}</p>` : ''}<p class="field-error" data-error-for="${name}" role="alert"></p></div>`;
}
export function formValues(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') out[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
    else out[el.name] = el.value;
  }
  return out;
}
export function showFormErrors(form, err) {
  form.querySelectorAll('[data-error-for]').forEach((p) => { p.textContent = ''; });
  form.querySelectorAll('[aria-invalid]').forEach((i) => i.removeAttribute('aria-invalid'));
  const top = form.querySelector('[data-form-error]');
  if (top) top.textContent = '';
  if (!err) return;
  let first = null;
  for (const [k, msg] of Object.entries(err.fields || {})) {
    const p = form.querySelector(`[data-error-for="${CSS.escape(k)}"]`);
    if (p) { p.textContent = msg; const inp = form.elements[k]; if (inp && inp.setAttribute) { inp.setAttribute('aria-invalid', 'true'); first = first || inp; } }
  }
  if (top) top.textContent = err.message;
  else toast(err.message, 'error');
  if (first) first.focus();
}
/** Wire a form: validates via the API, disables the button while sending, shows field errors. */
export function handleForm(form, fn) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    showFormErrors(form, null);
    if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = 'Please wait…'; }
    try { await fn(formValues(form), form); }
    catch (err) { if (err instanceof ApiError) showFormErrors(form, err); else { console.error(err); toast('Something went wrong.', 'error'); } }
    finally { if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = btn.dataset.label; } }
  });
}
/** Event delegation by data-action attribute. */
export function actions(root, type, map) {
  root.addEventListener(type, (e) => {
    const t = e.target.closest('[data-action]');
    if (!t || !root.contains(t)) return;
    const fn = map[t.dataset.action];
    if (fn) fn(t, e);
  });
}
export const setTitle = (t) => { document.title = `${t} | ${state.settings.restaurant_name || 'Restaurant'}`; };
export const lines = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);
