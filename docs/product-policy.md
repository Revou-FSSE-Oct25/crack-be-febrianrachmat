# Kebijakan produk & demo — Kinova / Crack

Dokumen ini menjelaskan **apa yang dijanjikan oleh aplikasi demo** (alur, pembayaran, data, dan batasannya) agar selaras dengan perilaku **backend NestJS** dan **frontend Next.js** pada repositori terkait. Ini **bukan** perjanjian hukum (ToS) penuh dan **bukan** saran medis.

**Pembaruan terakhir:** 2026-05-15 (diselaraskan dengan fitur di cabang `main`).

---

## 1. Tujuan dan ruang lingkup

- Aplikasi ini adalah **prototype / tugas** platform pemesanan fisioterapi dan konsultasi online, terinspirasi alur layanan digital pada umumnya.
- Lingkungan **demo** dapat memakai data fiktif, pembayaran **tidak** memproses kartu atau e-wallet sungguhan, dan infrastruktur (mis. hosting PaaS) dapat **menghapus unggahan file** sewaktu-waktu.
- Untuk detail teknis endpoint dan skema data, lihat indeks [`docs/README.md`](./README.md) dan file fitur bernomor (`10-auth-feature.md`, `15-booking-transaction-feature.md`, dll.).

---

## 2. Peran pengguna

| Peran | Ringkasan kemampuan |
|--------|----------------------|
| **Pasien** | Mendaftar/masuk, membuat booking kunjungan atau permintaan konsultasi online, membayar (dummy) dengan bukti, mengakses chat sesuai aturan status, memberi ulasan. |
| **Fisioterapis** | Profil dan tarif, slot ketersediaan, menerima/menolak alur konsultasi, memperbarui status booking/konsultasi sesuai transisi yang diizinkan, berpartisipasi dalam chat. |
| **Admin** | Verifikasi terapis, kategori, moderasi ulasan, **mengonfirmasi pembayaran dummy** dan **refund** pada transaksi, analitik ringkas sesuai modul admin. |

Hak akses mengikuti **JWT + RBAC**; kepemilikan resource (mis. booking milik pasien mana) dicek di lapisan layanan.

---

## 3. Booking kunjungan (visit fisik)

- Pasien memilih slot dan membuat booking; status mengikuti mesin status di API (mis. menunggu konfirmasi, berlangsung, selesai, dibatalkan) sebagaimana dijelaskan di dokumentasi fitur booking.
- **Tarif visit** disimpan sebagai snapshot pada booking agar nominal transaksi konsisten dengan saat booking dibuat.
- Pembatalan atau perubahan jadwal mengikuti aturan transisi **di aplikasi**; tidak ada janji SLA medis di luar yang tertulis di kode/dokumentasi teknis.

---

## 4. Konsultasi online dan chat

- Alur umum: pasien mengajukan keluhan → terapis dapat menerima → pasien membuat **transaksi pembayaran (pending)** dengan **bukti** → admin mengonfirmasi lunas → status konsultasi dapat berpindah ke sesi aktif sehingga **chat** terbuka sesuai implementasi (lihat `15-booking-transaction-feature.md` dan `16-chat-feature.md`).
- **SLA respons** (standar vs cepat saat terapis online) adalah aturan **produk demo**: jika batas waktu terlampaui tanpa respons terapis sesuai logika otomatisasi yang diaktifkan di server, sistem dapat melakukan **pengembalian (refund) otomatis** pada transaksi terkait. Detail angka menit dan cron dapat diatur lewat variabel lingkungan yang didokumentasikan di backend.
- Isi chat adalah **komunikasi antar pengguna terdaftar** dalam konteks demo; penyedia platform **tidak** memverifikasi kebenaran medis isi pesan.

---

## 5. Pembayaran (dummy) dan bukti

- **Tidak ada** pengalihan ke payment gateway produksi; yang ada adalah pencatatan transaksi dengan status `PENDING` / `PAID` / `REFUNDED` dan metode bayar sebagai label (mis. transfer, QRIS dummy).
- **Nominal** transaksi ditetapkan **server-side** dari snapshot booking atau konsultasi, bukan dari input bebas nominal oleh klien.
- Sebelum transaksi pending dibuat, pasien wajib melampirkan **bukti**: unggah file (gambar/PDF, dengan pembatasan tipe dan ukuran di server) **atau** URL `https` ke bukti. Tanpa bukti, admin **tidak** dapat menandai lunas (diblokir di API).
- File unggahan disimpan di disk server pada path publik `/uploads/...`; pada lingkungan cloud ephemeral, file dapat hilang setelah deploy ulang — gunakan URL bukti eksternal jika perlu persistensi untuk demo.

---

## 6. Konfirmasi admin dan refund manual

- Hanya **admin** yang dapat mengonfirmasi pembayaran dummy (`PAID`) atau melakukan **refund** pada transaksi yang memenuhi syarat status.
- Aksi admin penting dicatat dalam **log audit terstruktur** (JSON) di server untuk keperluan operasional demo, bukan pengadilan.

---

## 7. Data pribadi dan privasi (ringkas)

- Data yang diproses mencakup antara lain: identitas akun (email, nama profil), data booking/konsultasi, isi chat, notifikasi dalam aplikasi, bukti pembayaran (URL atau path file), dan ulasan.
- **Demo:** jangan memasukkan data kesehatan atau pribadi sensitif sungguhan. Gunakan data fiktif.
- Akses administratif mengikuti peran admin pada aplikasi; tidak ada jaminan retensi jangka panjang atau lokasi data untuk produksi.

---

## 8. Keamanan teknis (ringkas)

- Otentikasi JWT; rate limiting pada API; header keamanan umum (Helmet); CORS dapat dibatasi lewat `CORS_ORIGINS` di produksi.
- Detail implementasi dan pengujian: `30-hardening-testing-baseline.md` dan kode sumber modul terkait.

---

## 9. Disclaimer medis dan batas tanggung jawab

- Layanan ini **bukan** pengganti pemeriksaan fisik, diagnosis resmi, atau resep dari tenaga kesehatan berwenang.
- Pengguna bertanggung jawab atas keputusan medis mereka di luar aplikasi demo ini.

---

## 10. Ulasan dan moderasi

- Ulasan dapat disembunyikan atau dimoderasi oleh admin sesuai model data dan endpoint di modul review; alasan moderasi dapat disimpan untuk audit internal demo.

---

## 11. Perubahan dokumen

- Perubahan perilaku aplikasi sebaiknya diikuti pembaruan dokumen ini dan dokumentasi teknis bernomor di folder `docs/`.
- Jika ada pertentangan antara halaman marketing FE dan API, **API dan file `docs/*.md` di backend** dijadikan acuan perilaku sebenarnya.

---

## Pranala cepat

- Indeks dokumentasi teknis: [`docs/README.md`](./README.md)
- Transaksi & pembayaran dummy: [`15-booking-transaction-feature.md`](./15-booking-transaction-feature.md)
- Chat: [`16-chat-feature.md`](./16-chat-feature.md)
