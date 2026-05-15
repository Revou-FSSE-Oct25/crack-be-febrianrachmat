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
| `NODE_ENV=production` | Produksi | Wajib `JWT_SECRET` kuat (≥32 char) dan `CORS_ORIGINS` terisi. |

**Bukti bayar:** file upload hanya bisa diakses lewat `GET /transactions/:id/payment-proof` (JWT). Jangan mengandalkan URL `/uploads/...` publik.
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
| `npm run test:integration` | Postgres nyata | Set `TEST_DATABASE_URL`; jalan serial (`--runInBand`). |
| `npm run test:all` | Keduanya | Unit lalu integrasi. |
| `npm run build` | TypeScript compile | Wajib sukses sebelum deploy. |

**GitHub Actions** (`.github/workflows/ci.yml`): `npm ci` → `prisma generate` → `npm test` → `npm run build` pada setiap push/PR ke `main`. Integrasi DB **tidak** dijalankan di CI (butuh Postgres service); jalankan `test:integration` lokal sebelum submit besar.

Env CI: `DISABLE_THROTTLE=true`, `CONSULTATION_SLA_CRON=false`, placeholder `DATABASE_URL`.

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
- CI frontend: `npm run lint` + `npm run build` (lihat repo `crack-fe-febrianrachmat`).
- Cek koneksi API: `GET {NEXT_PUBLIC_API_URL}/health` atau route Next.js `/api/health` (proxy ringan).

---

## 8. Checklist sebelum demo / asesmen

- [ ] `/health` → `ok` + database `connected`
- [ ] `/docs` bisa dibuka; login demo berhasil
- [ ] `prisma:seed` sudah dijalankan (alur konsultasi/booking/transaksi terisi)
- [ ] Frontend `NEXT_PUBLIC_API_URL` mengarah ke API yang benar
- [ ] `npm test` hijau; `npm run test:integration` hijau jika mengubah alur kritis
