# Product Requirements Document (PRD): Boggle Pro High-Performance Solver

## 1. Project Overview

**Boggle Pro Solver** adalah aplikasi web premium yang dirancang untuk menyelesaikan permainan Boggle dengan kecepatan maksimal. Aplikasi ini menggabungkan keindahan antarmuka **Next.js 15 + Shadcn UI** dengan kekuatan pemrosesan **Golang** di sisi backend. Pengguna dapat merancang board kustom, memilih ukuran grid, dan menemukan kata secara instan melalui sistem dual-mode yang cerdas.

---

## 2. Core Features

### 2.1 Dual-Solver Engine

- **Target Word Mode:** Pengguna memasukkan satu kata spesifik; sistem mencari apakah kata tersebut ada di grid dan menampilkan jalurnya secara instan.
- **Global Discovery Mode:** Sistem secara otomatis memindai seluruh grid dan menampilkan semua kata valid berdasarkan kamus bahasa Inggris (300k+ kata).
- **Length Rule:** Panjang kata untuk mode global dan target dibatasi 3-8 huruf.

### 2.2 Interactive Visualization

- **Cell-Based Highlighting:** Jalur kata divisualisasikan dengan mengubah warna latar belakang sel menjadi **Sage Green Light** (`#B5EAD7`) dan border **Deep Sage** (`#4D8074`) saat kata di-hover pada daftar hasil. Tidak menggunakan garis penghubung (SVG paths) untuk menjaga estetika _clean_.
- **Smart Focus Grid:** Input huruf satu-persatu dengan navigasi kursor otomatis ke kotak berikutnya setelah satu karakter terisi (UX menyerupai input kode OTP).
- **Input Validation Feedback:** Hanya menerima huruf A-Z. Frontend otomatis mengubah input menjadi huruf besar. Jika user memasukkan selain huruf, cell berubah merah dan muncul banner warning.

### 2.3 Customization

- **Dynamic Scaler:** Mendukung ukuran grid fleksibel dari 3x3 hingga 8x8 melalui slider atau dropdown.
- **Min-Length Filter:** Filter hasil pencarian berdasarkan panjang minimum kata (default: 3 huruf).
- **Max-Length Rule (Global):** Hasil global dibatasi maksimal 8 huruf untuk konsistensi permainan.

---

## 3. Tech Stack & Architecture

| Layer             | Technology               | Role                                           |
| :---------------- | :----------------------- | :--------------------------------------------- |
| **Frontend**      | Next.js 15 (App Router)  | UI, State Management, Highlighting Logic.      |
| **Backend (API)** | **Golang (v1.2x)**       | High-performance Algorithm (DFS + Trie).       |
| **Styling**       | Tailwind CSS + Shadcn UI | Premium, clean, and botanical-inspired design. |
| **Deployment**    | **Vercel**               | Hosting Next.js & Serverless Go Functions.     |

---

## 4. Algorithm Specification (Golang)

Algoritma diimplementasikan di folder `/api` untuk memanfaatkan efisiensi memori dan kecepatan CPU Golang yang jauh lebih unggul untuk rekursi berat.

### 4.1 Data Structures

- **Trie (Prefix Tree):** Digunakan untuk menyimpan seluruh kamus bahasa Inggris. Memungkinkan pengecekan apakah sebuah rangkaian huruf merupakan kata valid atau prefix dari kata lain dalam waktu $O(L)$ di mana $L$ adalah panjang kata.

### 4.2 Search Method (DFS with Backtracking)

1.  **Iterasi:** Dimulai dari setiap sel $(r, c)$ di dalam grid.
2.  **Eksplorasi:** Melakukan pencarian rekursif ke 8 arah mata angin (horizontal, vertikal, diagonal).
3.  **Pruning:** Menggunakan Trie untuk menghentikan rekursi lebih awal jika rangkaian huruf saat ini tidak ditemukan sebagai prefix dalam kamus.
4.  **Visited State:** Memastikan satu sel tidak digunakan lebih dari satu kali dalam satu rangkaian kata.
5.  **Concurrency:** Memanfaatkan _Goroutines_ untuk menjalankan pencarian dari setiap sel secara paralel pada board berukuran besar.

### 4.3 Dictionary Data Cleaning (Global Mode)

Sumber wordlist disiapkan dari `wordfreq` (top 300k) lalu dibersihkan sebelum menjadi `api/dictionary.txt`:

1. **Ambil top 300k kata** bahasa Inggris dari `wordfreq`.
2. **Filter panjang kata 3-8** (hanya untuk mode global).
3. **Hanya A-Z** (hapus kata dengan tanda baca, angka, atau karakter non huruf).
4. **Uppercase + dedup** untuk konsistensi pencarian.
5. **Simpan ke `api/dictionary.txt`** satu kata per baris.

### 4.4 Performance Notes (Global Mode)

- Wordlist sekitar 190k kata (setelah filter 3-8) masih aman untuk Trie di Go.
- Performa utama ditentukan oleh DFS dan pruning prefix, bukan jumlah kata mentah.
- Ukuran board dan `min_length` kecil lebih berpengaruh ke waktu eksekusi.
- Goroutine per sel bisa diubah ke worker pool bila board kecil agar tidak over-parallel.

---

## 5. Design System (Sage & Slate Refined Modernism)

Aplikasi ini menggunakan estetika "Refined Botanical" untuk memberikan kesan tenang dan profesional.

### 5.1 Color Palette

- **Primary (Sage):** `#34675C` (Digunakan untuk tombol utama dan brand).
- **Highlight Cell:** `#B5EAD7` (Warna latar sel saat di-hover atau ditemukan).
- **Active Border:** `#4D8074` (Border sel yang sedang aktif dalam jalur kata).
- **Surface/Background:** `#F8FAF7` (Off-white botanical untuk mengurangi ketegangan mata).
- **Neutral Gray:** `#757876` (Warna teks utama untuk legibilitas tinggi).

### 5.2 Typography

- **Font Family:** **Geist** (Memberikan kesan presisi teknis namun tetap modern).
- **Headlines:** Semi-bold dengan tracking yang sedikit ketat (-0.02em).

### 5.3 Elevation & Shapes

- **Rounded:** Base radius **0.5rem (8px)** untuk elemen kecil dan **1rem (16px)** untuk card.
- **Shadows:** Ambient shadows (soft, multi-layered) dengan opacity rendah (4-8%) untuk efek kedalaman yang halus.

---

## 6. API Communication

### 6.1 Request (Next.js to Golang)

Endpoint: `POST /api/solve`

Field rules:

- `mode`: `global` atau `target`.
- `target`: wajib saat `mode=target`, hanya huruf A-Z dengan panjang 3-8.
- `min_length`: opsional, hanya dipakai saat `mode=global`.
- `min_length`: jika diberikan harus berada di rentang 3-8.
- `board`: array 2D huruf kapital, ukuran 3x3 sampai 8x8.

Contoh request untuk Global Mode:

```json
{
  "board": [
    ["A", "P", "P", "L"],
    ["E", "L", "O", "G"],
    ["E", "G", "I", "N"],
    ["T", "S", "E", "R"]
  ],
  "mode": "global",
  "min_length": 3
}
```

Contoh request untuk Target Word Mode:

```json
{
  "board": [
    ["A", "P", "P", "L"],
    ["E", "L", "O", "G"],
    ["E", "G", "I", "N"],
    ["T", "S", "E", "R"]
  ],
  "mode": "target",
  "target": "APPLE"
}
```

### 6.2 Response: Global Discovery Mode

Respons harus mengembalikan daftar kata lengkap dengan jalur (path) untuk kebutuhan highlight sel di UI.
Koordinat `path` menggunakan indeks berbasis 0 sesuai array `board`.

```json
{
  "mode": "global",
  "results": [
    {
      "word": "APPLE",
      "length": 5,
      "path": [
        { "r": 0, "c": 0 },
        { "r": 0, "c": 1 },
        { "r": 0, "c": 2 },
        { "r": 0, "c": 3 },
        { "r": 1, "c": 0 }
      ]
    },
    {
      "word": "LOG",
      "length": 3,
      "path": [
        { "r": 1, "c": 1 },
        { "r": 1, "c": 2 },
        { "r": 1, "c": 3 }
      ]
    }
  ],
  "meta": {
    "total": 2,
    "min_length": 3
  }
}
```

### 6.3 Response: Target Word Mode

Respons harus menyertakan status `found` dan `path` jika ditemukan, agar UI bisa highlight huruf pada matrix.

```json
{
  "mode": "target",
  "target": "APPLE",
  "found": true,
  "path": [
    { "r": 0, "c": 0 },
    { "r": 0, "c": 1 },
    { "r": 0, "c": 2 },
    { "r": 0, "c": 3 },
    { "r": 1, "c": 0 }
  ]
}
```

### 6.4 Request/Response Algorithm Logic (Ringkas)

Alur di bawah ini menjelaskan apa yang backend lakukan saat menerima request dan membentuk response:

1. **Validasi input:** cek ukuran board (3-8), huruf kapital A-Z, dan konsistensi panjang baris. Jika `mode=target`, pastikan `target` ada, hanya A-Z, dan panjang 3-8.
2. **Normalisasi:** ubah semua huruf ke kapital, dan siapkan struktur `visited` untuk DFS.
3. **Pemuatan Trie:** kamus dimuat sekali di startup, lalu digunakan ulang untuk semua request.
4. **Mode global:** DFS dari setiap sel, prune dengan Trie prefix, simpan kata valid beserta `path` urut. Kembalikan `results` lengkap dengan `word`, `length`, dan `path`.
5. **Mode target:** DFS seperti global, tetapi berhenti ketika `target` ditemukan. Kembalikan `found` dan `path` jika ada, atau `found=false` jika tidak ada.
6. **Response shaping:** tambahkan `meta` (mis. total, min_length) untuk global agar UI bisa filter lokal tanpa request ulang.
