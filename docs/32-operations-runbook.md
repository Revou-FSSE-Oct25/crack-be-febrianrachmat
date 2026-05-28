# Operations runbook (quality & deployment)

Panduan singkat untuk menjalankan, memantau, dan memecahkan masalah API di lingkungan **lokal**, **CI**, dan **Railway**.

**Pembaruan terakhir:** 2026-05-15

---

## 1. Health & monitoring

| Endpoint | Auth | Respons sukses |
|----------|------|----------------|
| `GET /health` | Publik (`@Public`) | `{ "status": "ok", "database": "connected" }` |
| `GET /health` (DB down) | Publik | `{ "status": "degraded", "database": "disconnected" }` |

- Railway memakai **`/health`** sebagai healthcheck (`railway.json` → `healthcheckPath`).
- Produksi: https://crack-be-febrianrachmat-production.up.railway.app/health
- Throttle **tidak** diterapkan pada `/health` (`@SkipThrottle`).

---

## 2. Environment variables

Lihat `.env.example`. Ringkasan:

| Variabel | Wajib | Keterangan |
|----------|-------|------------|
| `DATABASE_URL` | Ya | Postgres. Lokal/Railway shell publik: host `*.proxy.rlwy.net`. Di dalam Railway service: `postgres.railway.internal`. |
| `JWT_SECRET` | Ya | Secret penandatangan JWT — **jangan** commit nilai produksi. |
| `PORT` | Railway | Default app `3000` jika tidak diset. |
| `CORS_ORIGINS` | Produksi disarankan | Daftar origin frontend dipisah koma. Kosong = izinkan semua (dev). |
| `DISABLE_THROTTLE` | Opsional | `true` untuk test/CI agar rate limit tidak mengganggu. |
| `CONSULTATION_SLA_CRON` | Opsional | `false` menonaktifkan cron refund SLA otomatis (disarankan di CI/test). |
| `APPOINTMENT_REMINDER_CRON` | Opsional | `false` menonaktifkan cron reminder janji temu otomatis. |
| `APPOINTMENT_REMINDER_HOURS_BEFORE` | Opsional | Jarak reminder sebelum jadwal (default `24` jam). |
| `APPOINTMENT_REMINDER_WINDOW_MINUTES` | Opsional | Lebar window pengiriman reminder (default `60` menit). |
| `NODE_ENV=production` | Produksi | Wajib `JWT_SECRET` kuat (≥32 char) dan `CORS_ORIGINS` terisi. |

**Bukti bayar:** file upload hanya bisa diakses lewat `GET /transactions/:id/payment-proof` (JWT). Jangan mengandalkan URL `/uploads/...` publik.

**Railway env (wajib untuk FE↔BE):**

| Variable | Contoh |
|----------|--------|
| `CORS_ORIGINS` | URL frontend (pisah koma), mis. `https://crack-fe-febrianrachmat-production.up.railway.app` |
| `JWT_SECRET` | Min. 32 karakter acak, bukan `replace-with-a-strong-secret`. Generate: `openssl rand -base64 48` |

Tanpa `CORS_ORIGINS`, deploy tetap hidup tetapi browser memblokir request lintas-origin sampai variabel di-set.
| `RUN_DB_SEED` | Opsional | `true` sekali setelah deploy untuk memuat `prisma/seed.ts`. |
| `SEED_DEFAULT_PASSWORD` | Opsional | Override password akun demo (default `password123`). |

---

## 3. Database & seed

```bash
# Lokal — migrasi dev
npm run prisma:migrate

# Produksi / Railway — apply migrasi tanpa prompt
npm run prisma:migrate:deploy

# Data demo (akun, konsultasi, booking, transaksi, ulasan, PT pending)
npm run prisma:seed
```

**Akun demo** (setelah seed): lihat tabel di `README.md` — password default `password123`.

---

## 4. Testing & CI

| Perintah | Lingkungan | Catatan |
|----------|------------|---------|
| `npm test` | Unit + e2e-lite | Tidak butuh DB; mengabaikan `*.integration.spec.ts`. |
| `npm run test:cov` | Unit + e2e-lite + coverage | Output `coverage/`; ringkasan: `node scripts/print-coverage-summary.mjs`. |
| `npm run test:integration` | Postgres nyata | Set `TEST_DATABASE_URL`; jalan serial (`--runInBand`). |
| `npm run test:all` | Keduanya | Unit lalu integrasi. |
| `npm run build` | TypeScript compile | Wajib sukses sebelum deploy. |

**GitHub Actions** (`.github/workflows/ci.yml`): `npm ci` → `prisma generate` → `prisma migrate deploy` (Postgres 16 service `crack_integration_test`) → `npm run test:cov` → ringkasan coverage + artefak `coverage-report` → `npm run test:integration` → `npm run build` pada setiap push/PR ke `main`.

Env CI: `DATABASE_URL` / `TEST_DATABASE_URL` ke Postgres service, `DISABLE_THROTTLE=true`, `CONSULTATION_SLA_CRON=false`, `APPOINTMENT_REMINDER_CRON=false`.

### Export CSV (admin operasional)

- `GET /admin/operations/transactions/export?status=PENDING` — unduh transaksi (maks. 10.000 baris, UTF-8 BOM untuk Excel).
- `GET /admin/operations/bookings/export?status=PENDING` — unduh booking dengan filter status yang sama seperti list JSON.
- Frontend: tombol **Unduh CSV** di `/admin/operations` (tab pembayaran & monitoring booking).

### Manual trigger (admin operasional)

- `POST /admin/bookings/reminders/scan` — memicu scan reminder booking saat itu juga (di luar jadwal cron).
- Respons berisi jumlah booking yang dicek (`checked`), reminder terkirim (`sent`), dan metadata trigger (`triggeredBy`, `triggeredAt`).
- `GET /admin/bookings/reminders/last-scan` — observability endpoint untuk membaca ringkasan scan manual terakhir dari audit log.

---

## 5. Deploy Railway (backend)

1. Service Node + Postgres terhubung; `DATABASE_URL` internal di-inject ke app.
2. Build: `npm run build` (via Dockerfile / `railway.json`).
3. Start: `npm run start:prod`.
4. Set `JWT_SECRET`, `CORS_ORIGINS` (URL frontend), opsional `RUN_DB_SEED=true` sekali.
5. Migrasi: `npm run prisma:migrate:deploy` dari shell Railway atau laptop (URL **publik** DB).
6. Verifikasi: `GET /health` → `ok` + `database: connected`; buka `/docs`.

### Troubleshooting

| Gejala | Kemungkinan penyebab | Tindakan |
|--------|----------------------|----------|
| Docker build `exit code 137` pada `npm ci` | OOM saat `postinstall` + `prisma generate` + devDeps sekaligus | Dockerfile memakai `npm ci --ignore-scripts` lalu `npx prisma generate` terpisah; redeploy dari commit terbaru. |
| `MODULE_NOT_FOUND` / `dist/main.js` | Build gagal | Cek build logs; pastikan `npm run build` sukses. |
| DB connection refused dari laptop | Pakai URL internal | Ganti `.env` ke `DATABASE_PUBLIC_URL` (`*.proxy.rlwy.net`). |
| CORS error dari frontend | Origin tidak diizinkan | Set `CORS_ORIGINS` ke URL frontend. |
| Upload bukti hilang setelah redeploy | Disk ephemeral | Gunakan URL https eksternal untuk bukti persisten (demo). |

---

## 6. Keamanan operasional (ringkas)

Sudah diimplementasi di codebase:

- **Helmet** (header HTTP), **CORS** terkontrol, **rate limiting** global + ketat di login/register.
- Validasi global (`ValidationPipe`), JWT + RBAC, bukti bayar wajib sebelum konfirmasi admin.
- Cron SLA konsultasi dapat dimatikan lewat env.

Detail kebijakan produk: [`product-policy.md`](./product-policy.md).

---

## 7. Frontend (operasional)

- Set `NEXT_PUBLIC_API_URL` ke base URL API (bukan connection string Postgres).
- `JWT_SECRET` harus **sama** dengan backend (verifikasi token di middleware).
- CI frontend: `npm run lint` + `npm run build` + `npm test` (helper unit di `src/lib/**/*.test.ts`).
- Cek koneksi API: `GET {NEXT_PUBLIC_API_URL}/health`, route Next.js `/api/health`, atau halaman `/status` (tombol periksa ulang).
- **Panduan demo:** `/demo` — akun seed, alur happy path, checklist preflight. Login: pemilih akun demo + kata sandi `password123`.
- **Keandalan UI:** banner amber jika health gagal (polling ~90 detik); fetch API timeout 20 detik; halaman booking/transaksi/konsultasi punya tombol **Coba lagi** saat gagal muat.

---

## 8. Checklist sebelum demo / asesmen

- [ ] `/health` → `ok` + database `connected`
- [ ] `/docs` bisa dibuka; login demo berhasil
- [ ] `prisma:seed` sudah dijalankan (alur konsultasi/booking/transaksi terisi)
- [ ] Frontend `NEXT_PUBLIC_API_URL` mengarah ke API yang benar
- [ ] `npm test` hijau; `npm run test:integration` hijau jika mengubah alur kritis
