# Panduan publikasi gratis — Vercel + Supabase

## A. Siapkan Supabase
1. Buat project di https://supabase.com/dashboard.
2. Buka SQL Editor dan jalankan seluruh isi `supabase-schema.sql`.
3. Buka Project Settings > API (atau API Keys pada tampilan terbaru). Salin Project URL dan kunci server rahasia/service_role.

## B. Perbarui repository GitHub
1. Unggah isi folder paket ini ke root repository.
2. Pastikan `vercel.json`, `backend.js`, folder `api/`, folder `public/`, `content.json`, dan `package.json` berada di root repository.
3. Pastikan repository tidak menyimpan kunci rahasia atau file `.env`.

## C. Deploy di Vercel
1. Buka https://vercel.com/new dan pilih Continue with GitHub.
2. Impor repository yang tadi diperbarui. Untuk web Node.js ini, Vercel akan menggunakan konfigurasi proyek dan API function.
3. Pada Build and Output Settings, gunakan default; tidak perlu mengisi build command khusus.
4. Setelah proyek dibuat, buka Settings > Environment Variables. Isi variabel berikut untuk Production (boleh juga Preview/Development jika dibutuhkan):
   - `NODE_ENV` = `production`
   - `COOKIE_SECURE` = `true`
   - `ADMIN_EMAIL` = email admin pilihan sendiri
   - `ADMIN_PASSWORD` = password unik yang kuat
   - `SESSION_SECRET` = string acak panjang, minimal 32 karakter
   - `SUPABASE_URL` = URL project Supabase
   - `SUPABASE_SERVICE_ROLE_KEY` = kunci rahasia server Supabase
5. Simpan Environment Variables lalu lakukan Redeploy.
6. Buka URL `.vercel.app` yang ditampilkan Vercel.

## D. Tes sebelum dibagikan
- Halaman utama dan foto tampil.
- Guest bisa masuk dan menjelajah.
- Login admin memakai email/password yang kamu tetapkan.
- Admin dapat mengedit konten dan menyimpan.
- Setelah memuat ulang atau membuka tab baru, perubahan masih tersimpan.
- `/api/session` memberikan respons JSON dan login menggunakan cookie HttpOnly.

## Keamanan
Jangan pernah mengunggah `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, atau `.env` ke GitHub. Masukkan rahasia hanya lewat Environment Variables Vercel. Buat password admin baru, jangan gunakan kredensial contoh di README untuk website publik.


## Perbaikan jika Vercel menampilkan 404

Paket ini menetapkan `framework: null` (Other) dan `outputDirectory: public` di `vercel.json`. Di pengaturan project Vercel, pastikan **Root Directory** menunjuk ke folder utama repository (biasanya `.`), bukan subfolder. Setelah memastikan commit terbaru tercakup, buka **Deployments**, pilih deployment terbaru yang berstatus **Ready**, lalu gunakan URL dari tombol **Visit**. Jika tetap 404, lihat **Build Logs** dan tab **Source/Output** untuk memastikan `index.html` masuk ke output. Jangan menebak atau mengetik URL sendiri.
