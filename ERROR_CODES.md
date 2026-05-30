# Error Code Contract

Kontrak `errorCode` antara **backend** dan **frontend**. Setiap response error backend mengikuti envelope berikut:

```json
{
  "success": false,
  "timestamp": "2026-05-30T15:00:00.000Z",
  "path": "/bookings/123/status",
  "error": {
    "code": 400,
    "errorCode": "BOOKING_STATE_INVALID",
    "message": "Invalid booking status transition from COMPLETED to CANCELLED.",
    "details": { "...": "payload exception asli" }
  }
}
```

## Cara pakai (rekomendasi)

- **Sumber kebenaran tampilan = `errorCode`.** Frontend memetakan `errorCode` → teks lokal sendiri (tabel di bawah bisa langsung disalin jadi kamus i18n frontend).
- `message` dari backend adalah **fallback** (sudah mengikuti `Accept-Language` / `?lang` / header `x-lang`; default `en`).
- Beberapa pesan **dinamis** menyertakan nilai runtime lewat placeholder (mis. `{status}`, `{from}`, `{to}`) — lihat kolom "Args".

> Catatan: satu `errorCode` bisa dipakai untuk beberapa skenario (mis. `SLOT_UNAVAILABLE`). Kolom teks di bawah adalah saran generik; jika butuh spesifik, pakai `message` dari backend.

---

## Auth & Akun

| errorCode | HTTP | Arti | Teks ID (saran) | Teks EN (saran) | Args |
|---|---|---|---|---|---|
| `INVALID_CREDENTIALS` | 401 | Email/password salah | Email atau kata sandi salah. | Invalid email or password. | — |
| `SOCIAL_LOGIN_ONLY` | 401 | Akun pakai login sosial, tidak punya password | Akun ini menggunakan login sosial. Masuk dengan Google, Apple, GitHub, atau Facebook. | This account uses social login. Sign in with Google, Apple, GitHub, or Facebook. | — |
| `ACCOUNT_INACTIVE` | 401 | Akun nonaktif | Akun Anda tidak aktif. | Your account is inactive. | — |
| `EMAIL_ALREADY_REGISTERED` | 400 | Email sudah terdaftar | Email sudah terdaftar. | Email is already registered. | — |
| `REGISTRATION_ROLE_FORBIDDEN` | 400 | Registrasi publik tidak boleh buat admin | Registrasi publik tidak dapat membuat akun admin. | Public registration cannot create admin account. | — |
| `OAUTH_CONFIG_MISSING` | 400 | Konfigurasi OAuth (FRONTEND_URL) belum diset | FRONTEND_URL belum dikonfigurasi untuk pengalihan OAuth. | FRONTEND_URL is not configured for OAuth redirects. | — |
| `ACCOUNT_STATE_INVALID` | 400 | Status akun tidak valid untuk operasi (mis. admin self-deactivate / sudah nonaktif) | Akun admin tidak dapat menonaktifkan dirinya sendiri. / Akun sudah tidak aktif. | Admin accounts cannot be self-deactivated. / Account is already inactive. | — |
| `PASSWORD_CHANGE_INVALID` | 400 | Password baru = password lama | Kata sandi baru harus berbeda dari kata sandi saat ini. | New password must be different from current password. | — |
| `PASSWORD_UNAVAILABLE` | 400 | Akun sosial, fitur password tidak tersedia | Akun masuk lewat Google/Apple/GitHub/Facebook. Atur kata sandi belum tersedia untuk akun ini. | This account signs in via Google/Apple/GitHub/Facebook. Setting a password is not available for this account yet. | — |
| `USER_NOT_FOUND` | 404 | User tidak ditemukan | Pengguna tidak ditemukan. | User not found. | — |
| `TARGET_USER_NOT_FOUND` | 400 | User tujuan (notifikasi) tidak ada | Pengguna tujuan tidak ada. | Target user does not exist. | — |
| `AVATAR_NOT_FOUND` | 404 | Foto profil tidak ada / file hilang | Belum ada foto profil yang diunggah. | No profile photo uploaded. | — |
| `AVATAR_PATH_INVALID` | 400 | Jalur file avatar tidak valid | Jalur avatar tidak valid. | Invalid avatar path. | — |

## Profil Fisioterapis & Pasien

| errorCode | HTTP | Arti | Teks ID (saran) | Teks EN (saran) | Args |
|---|---|---|---|---|---|
| `PROFILE_NOT_FOUND` | 404 | Profil fisioterapis tidak ditemukan / belum disetujui | Profil fisioterapis tidak ditemukan. | Physiotherapist profile not found. | — |
| `PATIENT_PROFILE_NOT_FOUND` | 404 | Profil pasien tidak ditemukan | Profil pasien tidak ditemukan. | Patient profile not found. | — |
| `VERIFICATION_INVALID` | 400 | Input verifikasi admin tidak valid | Verifikasi admin harus APPROVED atau REJECTED. | Admin verification must be APPROVED or REJECTED. | — |
| `INVALID_FILTER` | 400 | Filter pencarian tidak valid (rentang fee terbalik) | minVisitFee tidak boleh lebih besar dari maxVisitFee. | minVisitFee cannot be greater than maxVisitFee. | — |

## Kategori

| errorCode | HTTP | Arti | Teks ID (saran) | Teks EN (saran) | Args |
|---|---|---|---|---|---|
| `CATEGORY_NOT_FOUND` | 404 / 400 | Kategori tidak ditemukan (404) / tidak ada saat update profil (400) | Kategori tidak ditemukan. | Category not found. | — |
| `CATEGORY_DUPLICATE` | 400 | Nama kategori sudah dipakai | Nama kategori sudah ada. | Category name already exists. | — |
| `CATEGORY_IN_USE` | 400 | Kategori masih dipakai fisioterapis | Kategori masih digunakan oleh fisioterapis dan tidak dapat dihapus. | Category is still used by physiotherapists and cannot be deleted. | — |

## Konsultasi & Booking

| errorCode | HTTP | Arti | Teks ID (saran) | Teks EN (saran) | Args |
|---|---|---|---|---|---|
| `CONSULTATION_STATE_INVALID` | 400 | Transisi/status konsultasi tidak valid | Transisi status konsultasi dari {from} ke {to} tidak valid. | Invalid consultation status transition from {from} to {to}. | `status` atau `from`,`to` |
| `BOOKING_STATE_INVALID` | 400 | Transisi/status booking tidak valid, atau belum CONFIRMED untuk bayar | Transisi status booking dari {from} ke {to} tidak valid. | Invalid booking status transition from {from} to {to}. | `status` atau `from`,`to` |
| `SLOT_UNAVAILABLE` | 400 | Slot tidak tersedia/sudah lewat/diambil | Slot yang dipilih sudah tidak tersedia. | Selected slot is no longer available. | — |
| `BOOKING_LOCKED` | 400 | Booking/slot terkunci untuk diubah | Booking hanya dapat dijadwalkan ulang selama masih menunggu konfirmasi. | Booking can only be rescheduled while still pending confirmation. | — |
| `INVALID_TIME_WINDOW` | 400 | Jendela waktu slot tidak valid | startTime harus sebelum endTime. | startTime must be before endTime. | — |
| `RESOURCE_NOT_FOUND` | 404 | Resource (mis. slot ketersediaan) tidak ditemukan | Slot ketersediaan tidak ditemukan. | Availability slot not found. | — |

## Transaksi & Pembayaran

| errorCode | HTTP | Arti | Teks ID (saran) | Teks EN (saran) | Args |
|---|---|---|---|---|---|
| `TRANSACTION_STATE_INVALID` | 400 | Status transaksi tidak sesuai (mis. refund non-PAID) | Hanya transaksi terbayar yang dapat dikembalikan. | Only paid transaction can be refunded. | — |
| `PAYMENT_PROOF_REQUIRED` | 400 | Bukti pembayaran belum dilampirkan | Tidak dapat mengonfirmasi pembayaran: tidak ada bukti pembayaran yang dilampirkan pada transaksi ini. | Cannot confirm payment: no payment proof is attached to this transaction. | — |

## Chat

| errorCode | HTTP | Arti | Teks ID (saran) | Teks EN (saran) | Args |
|---|---|---|---|---|---|
| `CHAT_LOCKED` | 400 | Chat terkunci (konsultasi belum IN_PROGRESS) | Chat terkunci. Konsultasi harus berstatus IN_PROGRESS (saat ini: {status}). | Chat is locked. Consultation must be IN_PROGRESS (current: {status}). | `status` |

## Review

| errorCode | HTTP | Arti | Teks ID (saran) | Teks EN (saran) | Args |
|---|---|---|---|---|---|
| `REVIEW_DUPLICATE` | 400 | Ulasan sudah ada untuk booking/konsultasi ini | Ulasan untuk booking ini sudah ada. | Review already exists for this booking. | — |
| `REVIEW_LOCKED` | 400 | Ulasan dimoderasi / di luar jendela edit | Ulasan sedang dimoderasi dan tidak dapat diubah atau dihapus. | Review is currently moderated and cannot be edited or deleted. | — |

## Notifikasi

| errorCode | HTTP | Arti | Teks ID (saran) | Teks EN (saran) | Args |
|---|---|---|---|---|---|
| `NOTIFICATION_NOT_FOUND` | 404 | Notifikasi tidak ditemukan / bukan milik user | Notifikasi tidak ditemukan. | Notification not found. | — |

## Validasi & Rate limit

| errorCode | HTTP | Arti | Teks ID (saran) | Teks EN (saran) | Args |
|---|---|---|---|---|---|
| `VALIDATION_FAILED` | 400 | Validasi DTO gagal; detail per-field ada di `error.message` (array) | Permintaan tidak valid. Periksa kembali isian Anda. | Validation failed. Please check your input. | — |
| _(tanpa errorCode)_ | 429 | Terlalu banyak request (ThrottlerGuard) | Terlalu banyak permintaan dari alamat ini. Coba lagi dalam beberapa saat. | Too many requests from this address. Please try again in a few moments. | — |

---

## Catatan untuk frontend

1. **Tangani `errorCode` dulu**, jatuhkan ke `message` backend hanya jika kode tidak dikenal.
2. **HTTP status umum tanpa `errorCode`:**
   - `401` tanpa `errorCode` → token tidak ada/expired → arahkan ke login.
   - `403` → role tidak punya akses (RBAC) → tampilkan "Anda tidak memiliki akses".
   - `404` generic → resource tidak ditemukan.
3. **Pesan validasi** (`VALIDATION_FAILED`): `error.message` bisa berupa gabungan beberapa pesan per-field (dipisah `, `). Backend sudah melokalkan pesan ini berdasarkan bahasa request.
4. **Bahasa**: kirim preferensi via `Accept-Language: id`, header `x-lang: id`, atau query `?lang=id`. Default `en`.

> Sumber kebenaran kode ada di `src/common/errors/business-error.ts` (tipe `BusinessErrorCode`). Jika menambah kode baru, perbarui tabel ini.
