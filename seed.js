'use strict';
/**
 * Seeds DEMO data (categories, sample dishes, tables, a sample promo) and creates the first admin.
 * All names, prices and testimonials below are placeholders - replace them from Admin.
 * Usage: npm run seed            (uses ADMIN_EMAIL / ADMIN_PASSWORD from .env)
 */
const crypto = require('crypto');
const { load } = require('../server/config');
const { openDatabase, tx } = require('../server/lib/db');
const { hashPassword } = require('../server/lib/auth');
const { slugify } = require('../server/lib/validate');

const CATEGORIES = ['Burgers', 'Pizza', 'Fast Food', 'Sandwiches', 'Rice and Biryani', 'BBQ', 'Desserts', 'Beverages'];

// [category, name, description, price_cents, featured, popular, variations[[name,delta]], extras[[name,price]]]
const FOODS = [
  ['Burgers', 'Classic Beef Burger', 'Grilled patty, lettuce, tomato, onion and house sauce in a toasted bun.', 899, 1, 1, [['Single', 0], ['Double', 350]], [['Cheese slice', 100], ['Fried egg', 120]]],
  ['Burgers', 'Crispy Chicken Burger', 'Crumb-coated chicken fillet with slaw and mayo.', 849, 0, 1, [], [['Cheese slice', 100]]],
  ['Pizza', 'Margherita Pizza', 'Tomato sauce, mozzarella and basil.', 1099, 1, 1, [['Small', 0], ['Medium', 300], ['Large', 700]], [['Extra cheese', 150], ['Olives', 100]]],
  ['Pizza', 'Spicy Chicken Pizza', 'Chicken, peppers and chilli on a tomato base.', 1299, 1, 0, [['Small', 0], ['Medium', 300], ['Large', 700]], [['Extra cheese', 150]]],
  ['Fast Food', 'Loaded Fries', 'Fries topped with cheese sauce and seasoning.', 549, 0, 1, [], [['Chicken bites', 200]]],
  ['Fast Food', 'Chicken Nuggets (8 pcs)', 'Golden nuggets with a dip of your choice.', 599, 0, 0, [], []],
  ['Sandwiches', 'Club Sandwich', 'Triple-decker with chicken, egg and salad.', 749, 0, 0, [], []],
  ['Sandwiches', 'Grilled Veggie Sandwich', 'Seasonal grilled vegetables with herb spread.', 649, 0, 0, [], []],
  ['Rice and Biryani', 'Chicken Biryani', 'Spiced rice layered with chicken, served with raita.', 999, 1, 1, [['Regular', 0], ['Large', 350]], [['Extra raita', 80]]],
  ['Rice and Biryani', 'Vegetable Pulao', 'Fragrant rice with mixed vegetables.', 799, 0, 0, [], []],
  ['BBQ', 'Mixed BBQ Platter', 'Assorted grilled meats with sides.', 1799, 1, 0, [], [['Extra flatbread', 100]]],
  ['BBQ', 'Grilled Chicken (half)', 'Marinated and chargrilled.', 1199, 0, 1, [], []],
  ['Desserts', 'Chocolate Brownie', 'Warm brownie with a chocolate drizzle.', 449, 0, 1, [], [['Ice cream scoop', 150]]],
  ['Desserts', 'Cheesecake Slice', 'Baked cheesecake with berry sauce.', 499, 0, 0, [], []],
  ['Beverages', 'Fresh Lemonade', 'Squeezed lemons, mint and ice.', 299, 0, 1, [['Regular', 0], ['Large', 100]], []],
  ['Beverages', 'Iced Coffee', 'Cold brew over ice.', 399, 0, 0, [], [['Extra shot', 100]]],
];

function seedDemo(db) {
  return tx(db, () => {
    if (db.prepare('SELECT COUNT(*) n FROM categories').get().n > 0) return false; // never overwrite real data
    const catId = {};
    CATEGORIES.forEach((name, i) => {
      catId[name] = Number(db.prepare('INSERT INTO categories (name, slug, sort_order) VALUES (?,?,?)').run(name, slugify(name), i).lastInsertRowid);
    });
    for (const [cat, name, desc, price, feat, pop, vars, extras] of FOODS) {
      const id = Number(db.prepare('INSERT INTO food_items (category_id, name, description, price_cents, featured, popular) VALUES (?,?,?,?,?,?)')
        .run(catId[cat], name, desc, price, feat, pop).lastInsertRowid);
      vars.forEach(([n, d], i) => db.prepare('INSERT INTO food_variations (food_id, name, price_delta_cents, sort_order) VALUES (?,?,?,?)').run(id, n, d, i));
      extras.forEach(([n, p]) => db.prepare('INSERT INTO food_extras (food_id, name, price_cents) VALUES (?,?,?)').run(id, n, p));
    }
    [['T1', 2], ['T2', 2], ['T3', 4], ['T4', 4], ['T5', 6], ['T6', 8]].forEach(([n, c]) => db.prepare('INSERT INTO dining_tables (name, capacity) VALUES (?,?)').run(n, c));
    db.prepare("INSERT INTO discount_codes (code, percent, min_subtotal_cents) VALUES ('WELCOME10', 10, 1000)").run();
    db.prepare("INSERT INTO promotions (title, description, code) VALUES ('Welcome offer (sample)', 'Get 10% off orders over the minimum. Edit or remove this promotion in Admin.', 'WELCOME10')").run();
    db.prepare("INSERT INTO testimonials (name, text, rating) VALUES ('Sample Customer', 'This is a sample review. Replace it with real customer feedback from Admin > Website.', 5)").run();
    return true;
  });
}

function ensureAdmin(db, email, password) {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return { created: false, email };
  let generated = false;
  if (!password) { password = crypto.randomBytes(9).toString('base64url') + '1a'; generated = true; }
  db.prepare("INSERT INTO users (name, email, phone, password_hash, role) VALUES ('Administrator', ?, '', ?, 'admin')").run(email, hashPassword(password));
  return { created: true, email, password: generated ? password : null };
}

module.exports = { seedDemo, ensureAdmin };

if (require.main === module) {
  const cfg = load();
  const db = openDatabase(cfg.dbPath);
  console.log(seedDemo(db) ? 'Demo menu data inserted.' : 'Menu data already present - skipped.');
  const a = ensureAdmin(db, (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase(), process.env.ADMIN_PASSWORD || '');
  if (!a.created) console.log(`Admin ${a.email} already exists.`);
  else console.log(`Admin created: ${a.email}` + (a.password ? `\nGenerated password (shown once): ${a.password}` : ' (password from ADMIN_PASSWORD)'));
  db.close();
}
