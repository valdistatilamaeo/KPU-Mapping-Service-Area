# KPU-Mapping-Service-Area

Sistem Informasi Geografis (GIS) dan Pemetaan Interaktif Wilayah Kerja Kantor Komisi Pemilihan Umum (KPU) Republik Indonesia, Provinsi, dan Kabupaten/Kota di seluruh 34 Provinsi Indonesia.

Dikembangkan oleh **PT Trigatra Sinergi Indonesia (TSI)** untuk pemantauan layanan integrasi sistem, penugasan teknis *Field Engineer / PIC*, dan pelaporan operasional.

---

## 🌟 Fitur Utama

- **Peta Interaktif Multi-Layer**:
  - **Peta Jalan HD**: Peta vektor jalan jelas untuk navigasi perkotaan.
  - **Hybrid**: Citra satelit resolusi tinggi berpadu dengan label batas wilayah dan nama jalan.
  - **Sci-Fi Vector HUD**: Tampilan visual taktis gelap dengan aksen neon khusus wilayah Indonesia.
- **Navigasi Cakupan Pulau (1 Pulau & Seluruh Indonesia)**:
  - Tombol pintas seleksi 8 cakupan: *Semua (Indonesia), Sumatera, Jawa, Sulawesi, Kalimantan, Papua, Maluku, Bali & Nusa Tenggara*.
  - Penghitungan otomatis rekap jumlah kantor KPU di setiap pulau.
- **Tagging Provinsi Akurat & Garis Petunjuk Putus-Putus (*Leader Lines*)**:
  - Penempatan badge rekap provinsi anti-tabrakan (*collision-free*).
  - Garis petunjuk putus-putus (*dashed line*) dengan titik jangkar bersinar (*anchor dot*) di pusat wilayah masing-masing provinsi.
- **Pencarian & Multi-Filter**:
  - Pencarian instan berdasarkan nama kantor, kota/kabupaten, nama PIC engineer, alamat, dan nomor telepon.
  - Filter cepat per Provinsi dan per Engineer PIC.
  - Kartu identitas detail dengan tautan langsung ke **WhatsApp** dan **Google Maps**.
- **Kontrol Zoom Lengkap**:
  - Tombol **Zoom In (+)** dan **Zoom Out (-)** pada bilah atas serta widget vertikal melayang di kanan peta.
  - Indikator level zoom dinamis (*real-time*).
  - Tombol fokus ulang (*Reset Bounds*).
- **Ekspor Gambar Peta Beresolusi Tinggi (PNG)**:
  - Pengambilan tangkapan layar peta (*capture*) beresolusi tinggi (Retina 2x).
  - Pembingkaian otomatis sesuai filter aktif (per Provinsi, per Pulau, per PIC Engineer, atau Seluruh Indonesia).
  - Bebas korupsi data (menggunakan konversi *Binary Blob Uint8Array* asli).

---

## 🚀 Cara Menjalankan Aplikasi

Aplikasi ini dapat dijalankan langsung melalui browser tanpa memerlukan konfigurasi database eksternal:

### Menggunakan Web Server Lokal (Node.js)
```bash
# Jalankan server lokal
node server.js
```
Buka browser dan akses: `http://localhost:3000`

### Menjalankan Langsung (File Lokal)
Cukup klik ganda file `index.html` pada File Explorer Anda (didukung penuh karena data telah dibundel secara mandiri di `data.js` dan `provinces.js`).

---

## 🛠️ Teknologi yang Digunakan
- **HTML5 & CSS3 Vanilla**: Desain responsif bertema *Glassmorphism Modern* (Hijau - Biru - Putih).
- **JavaScript (ES6+)**: Logika interaktif dan manipulasi data dinamis.
- **Leaflet.js**: Pustaka pemetaan GIS open-source berkinerja tinggi.
- **html2canvas**: Pembuatan tangkapan layar peta beresolusi tinggi ke format PNG.
- **FontAwesome 6**: Ikonografi modern.

---

## 🏢 Hak Cipta
© 2026 PT Trigatra Sinergi Indonesia (TSI). Seluruh hak cipta dilindungi undang-undang.
