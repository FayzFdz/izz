# Pengecekan lokal sebelum deploy

- `vercel.json` menetapkan Framework ke Other dan output statis ke `public`.
- Fungsi API berada di `api/[...path].js`.
- Backend menggunakan Supabase hanya jika `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` disetel di Environment hosting.
- Hosting online dan koneksi akun belum diverifikasi dari sini; setelah deploy, cek URL dari tombol Visit dan Build Logs.
