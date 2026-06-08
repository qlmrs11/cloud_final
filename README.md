# Kelompok 4 Helpdesk App

Kelompok 4 Helpdesk App adalah project full-stack sederhana untuk demo tugas cloud computing. Aplikasi ini memakai Cloudflare Pages sebagai frontend hosting, Cloudflare Pages Functions sebagai backend API, dan Cloudflare D1 sebagai database.

## Stack

- Frontend: HTML, CSS, JavaScript Vanilla
- Backend: Cloudflare Pages Functions
- Database: Cloudflare D1
- Tools: npm, Wrangler
- Deployment: Cloudflare Pages

## Struktur Folder

```text
kelompok-4-helpdesk-cloudflare/
├── public/
│   └── index.html
├── functions/
│   └── api/
│       ├── auth/
│       │   ├── register.js
│       │   └── login.js
│       └── tickets/
│           └── index.js
├── schema.sql
├── wrangler.toml
├── package.json
├── .gitignore
└── README.md
```

## Fitur

- Register user
- Login dan logout
- Role user dan admin
- User bisa membuat ticket/keluhan
- User hanya bisa melihat ticket miliknya sendiri
- Admin bisa melihat semua ticket
- Admin bisa update status dan prioritas ticket
- User dan admin bisa hapus ticket
- User dan admin bisa menambahkan komentar pada detail ticket
- Dashboard memiliki statistik, search, filter status, filter prioritas, dan panel detail
- Data tersimpan di Cloudflare D1

## Install

```bash
npm install
```

## Login Cloudflare

```bash
npx wrangler login
```

## Buat Database D1

```bash
npx wrangler d1 create kelompok4_helpdesk_db
```

Setelah database dibuat, Wrangler akan menampilkan `database_id`. Salin nilai tersebut ke `wrangler.toml`:

```toml
database_id = "REPLACE_WITH_YOUR_DATABASE_ID"
```

Ganti juga placeholder pada script `dev:d1` di `package.json`:

```json
"dev:d1": "wrangler pages dev public --d1 DB=REPLACE_WITH_YOUR_DATABASE_ID"
```

## Jalankan Schema Local

```bash
npx wrangler d1 execute kelompok4_helpdesk_db --local --file=./schema.sql
```

## Jalankan Schema Remote

```bash
npx wrangler d1 execute kelompok4_helpdesk_db --remote --file=./schema.sql
```

## Jalankan Lokal

```bash
npm run dev:d1
```

Buka URL lokal yang ditampilkan oleh Wrangler, biasanya:

```text
http://localhost:8788
```

## Deploy ke Cloudflare Pages

```bash
npm run deploy
```

Pastikan binding D1 bernama `DB` sudah terhubung ke project Cloudflare Pages.

Jika deploy memakai integrasi GitHub di Cloudflare Pages, gunakan pengaturan berikut:

```text
Build command: kosongkan atau echo "No build needed"
Build output directory: public
Root directory: /
```

Jangan memakai `npx wrangler pages deploy public` sebagai build command di dashboard Cloudflare Pages. Command tersebut hanya untuk deploy manual dari terminal.

## Akun Admin Demo

```text
email: admin@mail.com
password: admin123
```

## Catatan Security

Project ini dibuat untuk demo pembelajaran. Password pada database disimpan dalam bentuk plain text agar kode mudah dipahami. Jangan gunakan pola ini untuk aplikasi production. Pada aplikasi production, password harus di-hash, autentikasi harus memakai session/JWT yang aman, dan permission harus divalidasi lebih ketat.
