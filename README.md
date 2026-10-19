# A Little World — Personal Music Journal (Vercel-ready)

Website portofolio pribadi dengan mode Guest, login Admin, playlist, galeri, dan riwayat pendidikan. Struktur disiapkan untuk Vercel + Supabase.

## Deploy gratis lewat GitHub

1. Pastikan isi folder ini diunggah ke root repository GitHub.
2. Buat project di Supabase dan jalankan `supabase-schema.sql` pada SQL Editor.
3. Buka https://vercel.com/new, hubungkan GitHub, pilih repository, dan gunakan pengaturan default. `vercel.json` sudah menetapkan Framework = Other dan Output Directory = `public`; pastikan Root Directory di Vercel adalah root repository (kosong / `.`), bukan subfolder.
4. Pada Project Settings > Environment Variables, tambahkan `NODE_ENV=production`, `COOKIE_SECURE=true`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `SUPABASE_URL`, dan `SUPABASE_SERVICE_ROLE_KEY`.
5. Redeploy setelah menambahkan environment variables.
6. Uji URL publik, mode Guest, login Admin, simpan perubahan konten, dan buka website lagi untuk memastikan perubahan tetap tersimpan.

`SESSION_SECRET` harus acak, panjang, dan dirahasiakan. Jangan pernah menaruh `SUPABASE_SERVICE_ROLE_KEY` di file frontend atau repository publik. Gunakan password admin yang unik dan kuat; jangan gunakan kredensial lokal contoh pada website publik.

## Jalankan secara lokal

```bash
node server.js
```

Buka http://localhost:8000. Kredensial lokal untuk percobaan: `admin@littleworld.local` / `FaizWorld#2026`. Jangan gunakan akun lokal ini di produksi.

## Catatan penting

- Konten disimpan ke Supabase jika variabel URL dan key diatur. Tanpa database, website menggunakan `content.json` sebagai fallback, yang tidak cocok untuk penyimpanan edit persisten pada hosting serverless.
- Sesi admin ditandatangani agar valid di beberapa instance serverless; sesi berakhir setelah enam jam. Logout membersihkan cookie pada browser.
