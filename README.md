# 🍽️ Restaurant Management System

**A full-stack web app where customers order food and book tables, and staff run the whole restaurant from a secure admin dashboard.**

---

## 🚀 Overview

Customers can browse a live menu, build a cart, order for delivery or pickup, track their order, reserve a table, and manage their account. Restaurant staff use an admin dashboard to manage the menu, orders, reservations, customers, reports, and website content. It is built with only what ships with Node.js, so there are **zero npm runtime dependencies**.

> ⚠️ **Demo data notice:** the restaurant name, prices, dishes, discount code (`WELCOME10`), tables, and the sample review are placeholders created by `npm run seed`. Replace everything from **Admin → Website / Food Items**. There is no stock photography: dishes show generated placeholder art until you upload real photos.

---

## ✨ Features

### 👤 For Customers
- 🍔 **Dynamic menu** — category filter, search, sorting, featured and popular badges
- 🍕 **Dish details** — sizes, extras, quantity, and special instructions
- 🛒 **Smart cart** — saved in the browser, totals calculated on the server, delivery fee, and discount codes
- 🚚 **Delivery or pickup** — checkout with cash payment
- 📍 **Order tracking** — status timeline using order number + phone
- 🪑 **Table reservations** — with availability and conflict checks
- 🔑 **Accounts** — register, login, profile, order history, reservation history, password change
- 📩 **Contact form**, About page, offers, reviews, and opening hours

### 🛠️ For Admin
- 📊 **Dashboard** — real statistics and a revenue chart
- 🍽️ **Food management** — add, edit, delete, image upload, sizes, extras, and toggles
- 📦 **Order management** — search, filters, accept or reject, status workflow
- 🧑‍🤝‍🧑 **Customers** — view customers and their history
- 📅 **Reservations** — approve, reject, complete, cancel, assign tables
- 💰 **Reports** — daily, weekly, and monthly sales, and best sellers
- ⚙️ **Website settings** — content, hours, fees, discount codes, promotions, reviews, dining tables

---

## 📸 Screenshots

| Home Page (Desktop) | Menu (Mobile) |
| :---: | :---: |
| ![Home page](docs/screenshots/home-desktop.png) | ![Menu on mobile](docs/screenshots/menu-mobile.png) |

| Admin Dashboard | Add your 4th screenshot |
| :---: | :---: |
| ![Admin dashboard](docs/screenshots/admin-dashboard.png) | ![Screenshot 4](docs/screenshots/4.png) |

> 💡 Guide asks for 4–8 images. Save more with: `SHOTS_DIR=docs/screenshots npm run test:e2e`, then add them here.

---

## 🛠 Tech Stack

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)

| Layer | Tool |
|---|---|
| Backend | Node.js (built-in `http`) |
| Database | SQLite (built-in `node:sqlite`) |
| Frontend | Vanilla JavaScript single-page app, hand-written responsive CSS |
| Testing | `node:test` (41 API tests), Playwright (39 browser tests) |

**Why not React / Express / Prisma / PostgreSQL?** The project was built in an offline sandbox where `npm install` and a database server were unavailable, so it uses only what ships with Node.js 22. Every feature was actually run and tested. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#migrating-to-the-recommended-stack) to migrate later. Note: `node:sqlite` is marked experimental by Node.js.

---

## 🚀 How to Run

**Requirements:** Node.js **22.13 or newer** (check with `node -v`). Nothing else is needed.

### 1. Clone the repository
```bash
git clone https://github.com/alishaarif500/Resturant-Managament-System.git restaurant-management-system
cd restaurant-management-system
```

### 2. Set up environment variables
```bash
cp .env.example .env          # Windows: copy .env.example .env
```
Open `.env` and set `ADMIN_EMAIL` and (recommended) `ADMIN_PASSWORD`.

### 3. Create the database and admin account
```bash
npm run seed
```
If `ADMIN_PASSWORD` is empty, a random one is printed **once**. Save it.

### 4. Start the app
```bash
npm start
```

### 5. Open it
- 🌐 Customer site: `http://localhost:3000`
- 🔐 Admin: sign in at `#/login`, then you go to `#/admin`

### ⚙️ Configuration (`.env`)

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `NODE_ENV` | `development` | `production` enables Secure cookies and HSTS |
| `DB_PATH` | `./data/restaurant.db` | SQLite file |
| `UPLOAD_DIR` | `./public/uploads` | Uploaded food images |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | – | Used only by `npm run seed` |
| `COOKIE_SECURE` | `false` | Force the Secure flag on the session cookie |
| `TRUST_PROXY` | `false` | `true` only behind your own reverse proxy |

### 🧪 Run the tests
```bash
npm test                                  # 41 API tests, nothing extra to install
npm install && npx playwright install chromium
npm run test:e2e                          # 39 browser tests (Chromium)
```

---

## 📁 Project Structure

```text
restaurant-management-system/
├── server/
│   ├── index.js          # HTTP server, security headers, static files
│   ├── config.js         # .env loader
│   ├── lib/              # db, router, auth, validation, http helpers
│   ├── routes/           # public.js, account.js, admin.js
│   ├── services/         # pricing.js, orders.js, reservations.js
│   └── migrations/       # 001_init.sql
├── public/
│   ├── index.html
│   ├── css/styles.css
│   └── js/               # app.js, site.js, admin.js, lib.js
├── scripts/seed.js       # demo data + first admin
├── tests/                # api.test.js, e2e.js
├── docs/                 # ARCHITECTURE, API, TESTING, DEPLOYMENT, FEATURES, screenshots
└── README.md
```

---

## 🔒 Security

- 🔑 scrypt password hashing, random session tokens stored hashed
- 🍪 HttpOnly + SameSite=Lax cookies
- 🛡️ Server-side role checks on every admin route
- 🚫 Strict Content-Security-Policy, all output HTML-escaped
- 💾 Parameterised SQL everywhere
- 💵 Prices and totals always recalculated on the server
- 🖼️ Upload checks by magic bytes (PNG/JPEG/GIF/WebP only, max 2 MB)
- ⏱️ Rate limiting on login, orders, tracking, and contact

> This is not a replacement for a professional security review before real-world use.

---

## 📚 Documentation

[Architecture](docs/ARCHITECTURE.md) · [API](docs/API.md) · [Testing](docs/TESTING.md) · [Deployment](docs/DEPLOYMENT.md) · [Features](docs/FEATURES.md)

---

## ⚠️ Limitations

- No online payment (cash only)
- No email or SMS notifications
- No password-reset flow
- Cart lives in the browser, not the database
- Single-process in-memory rate limiter
- SQLite means one server, so back it up
- Report dates use server time (UTC)
- Browser tests ran on Chromium only, no load testing

---

## 👨‍💻 Developer

**Alisha Arif** — *Full-Stack Developer*

[![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/alishaarif500)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://linkedin.com/in/YOUR-USERNAME)

---

## 📄 License

MIT

---

⭐ **If you liked this project, drop a ⭐ on the repo and share it with others!**








