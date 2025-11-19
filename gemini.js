// === Gemini.js ===
import formidable from "formidable";
import fs from "fs";
import fetch from "node-fetch";
import dotenv from "dotenv";
import pkg from "pg";

dotenv.config();

const { Pool } = pkg;


// === Konfigurasi koneksi database ===
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// === Tes koneksi langsung saat deploy ===
(async () => {
  try {
    const result = await pool.query("SELECT NOW()");
    console.log("✅ Database terhubung!");
    console.log("🕒 Waktu server:", result.rows[0].now);
  } catch (err) {
    console.log("❌ Gagal konek database:", err.message);
  }
})();

export const config = { api: { bodyParser: false } }; // penting untuk handle upload file

// === Handler utama ===
export default async function handler(req, res) {
  // ====== METHOD GET → TES DATABASE MANUAL ======
  if (req.method === "GET") {
    try {
      const result = await pool.query("SELECT NOW()");
      console.log("✅ Tes koneksi DB berhasil!");
      console.log("🕒 Waktu server:", result.rows[0].now);
      res.status(200).send("Tes koneksi berhasil — cek log Vercel!");
    } catch (err) {
      console.log("❌ Tes koneksi gagal:", err.message);
      res.status(500).send("Tes koneksi gagal — cek log!");
    }
    return;
  }

  // ====== METHOD POST → PROSES GEMINI ======
  if (req.method === "POST") {
    console.log("🚀 Memulai proses Gemini...");


    // === KONFIGURASI GEMINI API ===

// Gunakan nilai dari .env lokal atau environment di Vercel
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

// Validasi jika key tidak ditemukan
if (!GEMINI_API_KEY) {
  console.error("❌ Kunci API Gemini tidak ditemukan di .env atau Environment Vercel.");
  if (typeof res !== "undefined" && res.status) {
    res.status(500).send("Kunci API tidak ditemukan.");
    return;
  }
  throw new Error("Kunci API Gemini tidak ditemukan di konfigurasi environment.");
}

console.log("✅ GEMINI_API_KEY berhasil dimuat.");

    const MODEL = "gemini-2.5-flash";
    const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
    
    try {
      const form = formidable({});
    
      const [fields, files] = await form.parse(req);

      const userPrompt = fields.prompt?.[0] || "";
      let parts = [];

      // === Jika ada gambar ===
      if (files.image?.[0]) {
        const file = files.image[0];
        const fileBuffer = fs.readFileSync(file.filepath);
        const base64Data = fileBuffer.toString("base64");

        parts.push({
          inlineData: { mimeType: file.mimetype, data: base64Data },
        });

        if (!userPrompt) {
          parts.push({
            text: "Jelaskan gambar ini secara detail dan informatif.",
          });
        }
      }

      // === Jika ada teks prompt ===
      if (userPrompt) {
        parts.push({ text: userPrompt });
      }

      if (parts.length === 0) {
        console.log("⚠️ Tidak ada konten (teks/gambar) yang dikirim.");
        res.status(400).send("Tidak ada konten untuk diproses");
        return;
      }

      
      // === Panggil API Gemini ===
      const response = await fetch(
        `${BASE_URL}/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts }] }),
        }
      );

      // 🛑 SOLUSI: Cek status HTTP terlebih dahulu
      if (!response.ok) {
        // Jika status BUKAN 200 (misalnya 503, 429), coba baca sebagai teks
        const errorText = await response.text(); 
        
        console.error(`❌ API Error [Status ${response.status}]:`, errorText);

        // Pastikan Anda mengirim respons JSON ke FrontEnd agar FrontEnd tidak crash
        res.status(response.status || 500).json({ 
            error: {
                message: errorText.substring(0, 256) // Potong pesan error jika terlalu panjang
            } 
        });
        return;
      }

      // Jika response.ok adalah TRUE, aman untuk mengurai JSON
      const data = await response.json(); 

      if (data.error) {
        console.log("❌ API Error (dalam JSON):", data.error.message);
        res.status(data.error.code || 500).json({ 
             error: data.error 
        }); // Kirim JSON error ke FrontEnd
        return;
      }
      

      const text =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "Maaf Gemini-lab Tidak Dapat Memproses Gambar Yang Tidak Pantas.";

      console.log("✅ Respons Gemini:", text);
      res.status(200).json({ result: text });
    
    } catch (err) {
      console.log("❌ Kesalahan internal:", err.message);
      // ⚠️ Ganti .send() menjadi .json() untuk konsistensi
      res.status(500).json({ 
          error: {
              message: "Kesalahan internal server: " + err.message
          }
      });
    }
    return;
  }


  // ====== METHOD LAIN ( selain GET & POST ) ======
  console.log("⚠️ Metode tidak diizinkan:", req.method);
  res.status(405).send("Gunakan GET atau POST.");
}
