# Boggle Pro Solver

Aplikasi ini adalah solver untuk permainan Boggle, dibangun menggunakan Next.js, TypeScript, dan Tailwind CSS. Proyek memberikan antarmuka web untuk membuat papan huruf, mencari semua kata yang valid, atau memeriksa kata target pada papan.

## Ringkasan Proyek

- `Next.js` sebagai framework frontend dan API route.
- `TypeScript` untuk tipe statis dan keamanan kode.
- `Tailwind CSS` untuk styling komponen UI.
- `Go` menyediakan implementasi solver alternatif di `api/handler.go`.
- `api/dictionary.txt` berisi kata kamus sebagai sumber validasi.

## Fitur Utama

1. Mode `global`:
   - Menemukan semua kata valid pada papan Boggle.
   - Hasil ditampilkan dengan jumlah kata dan filter panjang.
2. Mode `target`:
   - Mencari apakah kata tertentu ada pada papan.
   - Menampilkan path sel kata jika ditemukan.
3. Papan huruf dinamis:
   - Ukuran papan bisa diubah dari 3x3 sampai 8x8.
   - Input otomatis pindah fokus sel.
   - Highlight sel untuk path kata.
4. Tema gelap/terang menggunakan `localStorage`.

## Cara Menjalankan

1. Install dependensi:

```bash
npm install
```

2. Jalankan aplikasi development:

```bash
npm run dev
```

3. Buka browser ke `http://localhost:3000`

4. Untuk produksi:

```bash
npm run build
npm run start
```

## Struktur Folder dan Deskripsi File

### Root

- `README.md`
  - Dokumentasi proyek.
- `package.json`
  - Daftar dependensi frontend dan skrip `dev`, `build`, `start`, `lint`.
- `go.mod`
  - Modul Go untuk backend solver alternatif.

### `src/app`

- `layout.tsx`
  - Layout global aplikasi.
  - Mengatur metadata halaman dan font global.
  - Memuat font `Geist` dari Google.
- `page.tsx`
  - Halaman utama aplikasi Boggle.
  - Menangani state papan, mode, target, hasil, tema, dan UI interaksi.
  - Mengirim request `POST` ke API route `/api/solve`.
  - Menyediakan fungsi utilitas antre lain seperti pembuatan papan kosong, pembuatan papan acak, normalisasi hasil, dan fallback hasil.

### `src/app/api/solve/route.ts`

API route Next.js untuk solver Boggle.

Bagian penting:
- Validasi input `board`, `mode`, `target`, dan `min_length`.
- `loadTrie()`:
  - Membaca `api/dictionary.txt`.
  - Membuat Trie dari kata-kata valid.
- `solveGlobal(board, trie, minLength)`:
  - DFS untuk menemukan semua kata valid.
  - Mendukung 8 arah pergerakan.
- `solveTarget(board, target)`:
  - DFS untuk mencari path kata target.
- Response JSON:
  - Mode `global`: `results`, `meta.total`, `meta.min_length`.
  - Mode `target`: `target`, `found`, `path`.

### `src/components/boggle`

#### `Board.tsx`

Komponen papan input Boggle.

Fungsi utama:
- Render grid ukuran dinamis.
- Input setiap sel hanya satu huruf.
- Sanitasi karakter non-huruf.
- Navigasi sel dengan arrow keys dan backspace.
- Menandai sel invalid dan sel yang di-highlight.

#### `List.tsx`

Komponen daftar hasil kata.

Fungsi utama:
- Menampilkan jumlah total kata yang ditemukan.
- Filter kata berdasarkan panjang.
- Search kata dengan query teks.
- Highlight dan pilih kata.

### `src/components/ui`

Komponen UI generik yang digunakan oleh antarmuka.

- `button.tsx`
  - Komponen tombol dengan variant dan ukuran.
  - Menggunakan `class-variance-authority` dan `clsx`.
- `input.tsx`
  - Komponen input teks bergaya.
- `badge.tsx`
  - Komponen badge informatif untuk jumlah item.

### `src/lib`

- `types.ts`
  - Tipe data `WordPathNode`, `WordResult`, dan `BoardCell`.
- `utils.ts`
  - Helper `cn(...)` untuk menggabungkan kelas Tailwind.

## Logika Utama Frontend

### `page.tsx`

State yang digunakan:
- `mode`: `global` atau `target`
- `boardSize`: ukuran papan
- `board`: array 2D huruf papan
- `minLength`: panjang minimal kata untuk mode global
- `targetWord`: kata target mode target
- `results`: daftar hasil `WordResult`
- `activeWord`: kata yang dipilih
- `hoveredWord`: kata yang sedang di-hover
- `theme`: tema `light`/`dark`
- `invalidCells`: sel dengan input tidak valid

Utilities di `page.tsx`:
- `createEmptyBoard(size)`
  - Menghasilkan papan kosong.
- `resizeBoard(board, size)`
  - Mengubah ukuran papan dengan mempertahankan huruf yang sudah ada.
- `createRandomBoard(size)`
  - Mengisi papan dengan huruf acak A-Z.
- `buildHighlightSet(path)`
  - Membuat set posisi untuk menyorot path kata.
- `scoreWord(word)`
  - Menghitung poin kata berdasarkan panjang.
- `normalizePath(path)`
  - Menormalisasi path dari API ke objek `WordPathNode`.
- `normalizeResults(data)`
  - Mengonversi format respons API menjadi `WordResult` standar.
- `buildFallbackResults(board, minLength)`
  - Membangun daftar kata sederhana saat server belum mengembalikan hasil.

### Tema
- Tema awal dibaca dari `localStorage`.
- Jika tidak ada, mengambil dari `prefers-color-scheme` sistem.
- Tema disimpan kembali saat diubah.

## Logika Backend API (Next.js)

### Trie dan Dictionary

- Trie digunakan untuk menyimpan kata-kata kamus secara efisien.
- `loadTrie()` hanya memasukkan kata yang:
  - Panjang >= 3
  - Hanya huruf A-Z
  - Mengandung minimal satu vokal `AEIOUY`

### `solveGlobal`

Proses:
- Mulai DFS dari setiap sel papan.
- Traversal 8 arah.
- Hanya lanjut jika prefix ada di Trie.
- Simpan setiap kata valid dan pathnya.

### `solveTarget`

Proses:
- Mencari path yang membentuk kata target.
- Mulai dari sel yang cocok huruf pertama.
- Menjalankan DFS hingga huruf terakhir.
- Mengembalikan path sel jika ditemukan.

## Backend Alternatif: Go

Folder `api` berisi implementasi Go sebagai solver terpisah.

### `api/handler.go`

Fungsi utama:
- Implementasi Trie di Go.
- `SolveGlobal`: mencari semua kata menggunakan DFS parallel goroutine.
- `SolveTarget`: mencari path kata target.
- `validateBoard`: validasi ukuran dan karakter papan.
- `loadTrie`: memuat `dictionary.txt` ke Trie.
- `Handler`: entrypoint HTTP yang menerima `POST` JSON.

### `api/dictionary.txt`

- Berisi daftar kata satu per baris.
- Kata digunakan sebagai kamus validasi solver.

## Catatan Tambahan

- Aplikasi utama berjalan sebagai aplikasi Next.js.
- Go backend tidak terhubung langsung ke frontend, tetapi berfungsi sebagai referensi implementasi alternatif.
- Dokumentasi ini cocok dipakai untuk laporan tugas atau presentasi.

## Rekomendasi Perbaikan Dokumentasi

- Perbarui `README.md` dengan cara penggunaan lebih spesifik.
- Tambahkan contoh input JSON untuk API.
- Jelaskan struktur data `WordResult` dan `Cell` secara lebih detail jika diperlukan.
