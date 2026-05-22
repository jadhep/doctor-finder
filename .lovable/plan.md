# Rencana: Scraper Kontak Praktek Dokter Mandiri (Depok)

## Tujuan
Script Python sederhana yang mencari "Praktek Dokter Mandiri" di area Depok via Google Maps Platform (Places API New) dan menghasilkan file CSV berisi **Nama, Alamat, Nomor Telepon**.

## Pendekatan
- Bahasa: Python 3 (dijalankan di sandbox Lovable lewat `code--exec`).
- Sumber data: **Lovable Google Maps connector** (Places API New) lewat connector gateway — tanpa perlu API key pribadi.
- Output: `/mnt/documents/dokter_depok.csv` (bisa langsung di-download user).

## Alur Eksekusi
1. Hubungkan connector `google_maps` ke project (sekali saja).
2. Script melakukan **Text Search** ke endpoint `places/v1/places:searchText` dengan query seperti:
   - "Praktek Dokter Mandiri Depok"
   - Paginasi pakai `nextPageToken` sampai habis (maks ~60 hasil per query — limit Google).
3. Untuk meningkatkan cakupan, query diulang per kecamatan Depok (Beji, Pancoran Mas, Cipayung, Sukmajaya, Cilodong, Cimanggis, Tapos, Sawangan, Bojongsari, Limo, Cinere) — hasil di-dedupe via `place.id`.
4. Field yang diminta lewat header `X-Goog-FieldMask`:
   - `places.id, places.displayName, places.formattedAddress, places.nationalPhoneNumber, places.internationalPhoneNumber`
5. Tulis ke CSV: kolom **Nama | Alamat | Telepon**.
6. Tampilkan ringkasan (jumlah total, jumlah dengan nomor telepon).

## Struktur File
```
scripts/
  scrape_dokter_depok.py      # script utama (bisa dijalankan ulang dengan area lain)
```
Script bersifat **standalone** — bukan bagian dari web app TanStack. Web project tidak diubah.

## Cara Pakai (untuk Anda)
1. Saya jalankan script-nya untuk Anda di chat — hasilnya langsung muncul sebagai file CSV yang bisa di-download.
2. Jika ingin area lain (misal Jakarta Selatan), tinggal minta: "jalankan untuk Jakarta Selatan".

## Catatan Teknis
- Endpoint: `https://connector-gateway.lovable.dev/google_maps/places/v1/places:searchText` (POST).
- Header wajib: `Authorization: Bearer $LOVABLE_API_KEY`, `X-Connection-Api-Key: $GOOGLE_MAPS_API_KEY`, `X-Goog-FieldMask: ...`.
- Validasi env var sebelum eksekusi.
- Rate limit: jeda 2 detik antar request `nextPageToken` (syarat Google).

## Batasan yang Perlu Anda Tahu
- Google Maps **hanya membatasi 60 hasil per query teks**. Strategi multi-kecamatan mengatasi sebagian, tapi tidak menjamin 100% praktek di Depok terdata.
- Tidak semua listing Google Maps mencantumkan nomor telepon — baris tanpa telepon akan tetap masuk CSV (kolom kosong) agar Anda tahu place-nya ada.
- Data milik Google; gunakan sesuai [Terms of Service](https://cloud.google.com/maps-platform/terms).
