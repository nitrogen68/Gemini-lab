// === /api/updateHits.js (Perbaikan) ===
import { Buffer } from 'buffer'; // Penting jika Anda menggunakan Vercel

export default async function handler(req, res) {
  // 1. Perbaikan Kritis: Handle POST request body
  // API ini tidak menerima body, jadi tidak perlu memeriksa body.
  // Tapi jika Anda ingin mengizinkan POST tanpa body, logika ini OK.
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    if (!GITHUB_TOKEN) {
        return res.status(500).json({ error: "GITHUB_TOKEN tidak ditemukan." });
    }

    // Menggunakan URL tanpa ?ref=main di sini (opsional, tapi lebih bersih)
    const API_URL = "https://api.github.com/repos/nitrogen68/Gemini-lab/contents/data/hits.json";

    // --- 1. Ambil file lama (GET) ---
    const getRes = await fetch(`${API_URL}?ref=main`, { // Tambahkan ref=main di sini
      headers: {
        // PERHATIAN: Gunakan token di header Authorization untuk Octokit/Fetch
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json"
      },
    });

    // 2. Perbaikan: Handle file tidak ditemukan (404)
    if (!getRes.ok && getRes.status !== 404) {
        throw new Error(`Gagal ambil file: ${getRes.status} ${await getRes.text()}`);
    }

    const existing = getRes.status !== 404 ? await getRes.json() : null;
    let currentHits = 0;
    let sha = undefined;

    if (existing && existing.content) {
      // Menggunakan Buffer.from() yang lebih handal
      const decoded = Buffer.from(existing.content, "base64").toString("utf-8");
      const parsed = JSON.parse(decoded);
      currentHits = parsed.hits || 0;
      sha = existing.sha;
    }
    
    // Jika file tidak ada (404), sha tetap undefined, dan currentHits = 0.

    // --- 2. Siapkan Data Baru ---
    const newData = {
      hits: currentHits + 1,
      updated: new Date().toISOString(),
    };

    const newContentBase64 = Buffer.from(JSON.stringify(newData, null, 2)).toString("base64");

    // --- 3. PUT update ke GitHub ---
    const putRes = await fetch(API_URL, {
      method: "PUT",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github.v3+json"
      },
      body: JSON.stringify({
        message: `[Automated] Hits update: ${newData.hits}`, // Pesan commit yang lebih informatif
        content: newContentBase64,
        // WAJIB: sha hanya disertakan jika file sudah ada (yaitu, saat update)
        // Jika sha adalah undefined (file baru), GitHub akan membuatnya.
        sha: sha, 
      }),
    });

    if (!putRes.ok) {
        const errorDetail = await putRes.json();
        // Melempar error GitHub untuk debugging
        throw new Error(`Gagal update: ${putRes.status} - ${errorDetail.message || 'Unknown error'}`);
    }

    return res.status(200).json({
      success: true,
      hits: newData.hits,
      updated: newData.updated,
      sha: existing ? existing.sha : "new file created"
    });
  } catch (err) {
    console.error("Error saat update hits:", err.message);
    return res.status(500).json({ error: "Gagal memproses hits: " + err.message });
  }
}
