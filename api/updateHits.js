// === /api/updateHits.js (Final Fix with Committer & Author) ===

export default async function handler(req, res) {
  // 1. Validasi Metode HTTP
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // NOTE: Logika di sini sudah benar untuk MENGABAIKAN req.body,
  // yang seharusnya menyelesaikan error 400 jika frontend mengirim header yang benar.
  
  try {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    if (!GITHUB_TOKEN) {
        return res.status(500).json({ error: "GITHUB_TOKEN tidak ditemukan." });
    }

    const API_URL = "https://api.github.com/repos/nitrogen68/Gemini-lab/contents/data/hits.json";

    // --- 1. Ambil file lama (GET) ---
    const getRes = await fetch(`${API_URL}?ref=main`, { 
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json"
      },
    });

    // 2. Handle file tidak ditemukan (404)
    if (!getRes.ok && getRes.status !== 404) {
        throw new Error(`Gagal ambil file: ${getRes.status} ${await getRes.text()}`);
    }

    const existing = getRes.status !== 404 ? await getRes.json() : null;
    let currentHits = 0;
    let sha = undefined;

    if (existing && existing.content) {
      // Buffer adalah objek global di Vercel/Node.js
      const decoded = Buffer.from(existing.content, "base64").toString("utf-8");
      const parsed = JSON.parse(decoded);
      currentHits = parsed.hits || 0;
      sha = existing.sha;
    }
    
    // --- 2. Siapkan Data Baru ---
    const newData = {
      hits: currentHits + 1,
      updated: new Date().toISOString(),
    };

    const newContentBase64 = Buffer.from(JSON.stringify(newData, null, 2)).toString("base64");
    
    // DETAIL COMMITTER (Ganti dengan detail Anda jika perlu)
    const committerDetails = {
      name: "Gemini-Lab Automated Bot", 
      email: "bot-notification@example.com" 
    };

    // --- 3. PUT update ke GitHub ---
    const putRes = await fetch(API_URL, {
      method: "PUT",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github.v3+json"
      },
      body: JSON.stringify({
        message: `[Automated] Hits update: ${newData.hits}`, 
        content: newContentBase64,
        
        // >>> PENAMBAHAN COMMITTER & AUTHOR <<<
        committer: committerDetails,
        author: committerDetails, // Biasanya sama dengan committer untuk script otomatis
        
        sha: sha, 
      }),
    });

    if (!putRes.ok) {
        const errorDetail = await putRes.json();
        throw new Error(`Gagal update: ${putRes.status} - ${errorDetail.message || 'Unknown error'}`);
    }

    return res.status(200).json({
      success: true,
      hits: newData.hits,
      updated: newData.updated
    });
  } catch (err) {
    console.error("Error saat update hits:", err.message);
    return res.status(500).json({ error: "Gagal memproses hits: " + err.message });
  }
}
