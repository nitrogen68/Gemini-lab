// === /api/updateHits.js (FINAL RECOMMENDED) ===
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    if (!GITHUB_TOKEN) {
      return res.status(500).json({ error: "GITHUB_TOKEN tidak ditemukan." });
    }

    const API_URL = "https://api.github.com/repos/nitrogen68/Gemini-lab/contents/data/hits.json";
    const BRANCH = "main";

    // --- 1. GET file lama ---
    const getRes = await fetch(`${API_URL}?ref=${BRANCH}`, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    let currentHits = 0;
    let sha = null;

    if (getRes.status === 404) {
      // File belum ada
    } else if (!getRes.ok) {
      throw new Error(`Gagal ambil file: ${getRes.status} ${await getRes.text()}`);
    } else {
      const existing = await getRes.json();
      const decoded = Buffer.from(existing.content, "base64").toString("utf-8");
      const parsed = JSON.parse(decoded);
      currentHits = parsed.hits || 0;
      sha = existing.sha;
    }

    // --- 2. Data baru ---
    const newData = {
      hits: currentHits + 1,
      updated: new Date().toISOString(),
    };

    const newContentBase64 = Buffer.from(JSON.stringify(newData, null, 2)).toString("base64");

    // --- 3. Committer (gunakan noreply GitHub) ---
    const committer = {
      name: "Gemini-Lab Bot",
      email: "nitrogen68@users.noreply.github.com", // GANTI DENGAN USERNAME KAMU
    };

    // --- 4. PUT update ---
    const putBody = {
      message: `[Automated] Hits update: ${newData.hits}`,
      content: newContentBase64,
      branch: BRANCH,
      committer,
      author: committer,
    };

    if (sha) putBody.sha = sha; // Hanya jika update

    const putRes = await fetch(API_URL, {
      method: "PUT",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github.v3+json",
      },
      body: JSON.stringify(putBody),
    });

    if (!putRes.ok) {
      const err = await putRes.json();
      throw new Error(`GitHub API error: ${putRes.status} - ${err.message}`);
    }

    return res.status(200).json({
      success: true,
      hits: newData.hits,
      updated: newData.updated,
    });
  } catch (err) {
    console.error("Error update hits:", err.message);
    return res.status(500).json({ error: "Gagal update hits: " + err.message });
  }
}
