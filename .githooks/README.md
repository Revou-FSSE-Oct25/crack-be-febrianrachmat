# Hooks lokal (opsional)

Hook `prepare-commit-msg` menghapus baris `Co-authored-by: Cursor ...` dari pesan commit sebelum commit disimpan, supaya GitHub tidak menampilkan dua author.

Aktifkan satu kali di repo ini:

```bash
git config core.hooksPath .githooks
```

Nonaktifkan (kembali ke default Git):

```bash
git config --unset core.hooksPath
```

Di Windows, jalankan perintah di atas dari **Git Bash** atau terminal yang sama dengan instalasi Git Anda.
