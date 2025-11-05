// /pages/api/updateHits.js  (atau /api/updateHits.js)

// WAJIB: Aktifkan body parser
export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Baca body
  const { slug } = req.body || {};

  // Validasi slug
  if (!slug || typeof slug !== "string") {
    return res.status(400).json({ 
      error: "Field 'slug' diperlukan dan harus string" 
    });
  }

  try {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    if (!GITHUB_TOKEN) {
      return res.status(500).json({ error: "Token GitHub tidak ditemukan" });
    }

    const API_URL = "https://api.github.com/repos/nitrogen68/Gemini-lab/contents/data/hits.json";
    const BRANCH = "main";

    // GET file
    const getRes = await fetch(`${API_URL}?ref=${BRANCH}`, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    let currentData = { total: 0, pages: {} };
    let sha = null;

    if (getRes.ok) {
      const existing = await getRes.json();
      const decoded = Buffer.from(existing.content, "base64").toString();
      currentData = JSON.parse(decoded);
      sha = existing.sha;
    } else if (getRes.status !== 404) {
      throw new Error("Gagal ambil file");
    }

    // Update hits
    currentData.pages[slug] = (currentData.pages[slug] || 0) + 1;
    currentData.total += 1;
    currentData.updated = new Date().toISOString();

    const newContent = Buffer.from(JSON.stringify(currentData, null, 2)).toString("base64");

    const putBody = {
      message: `[Bot] Hit: ${slug} → ${currentData.pages[slug]}`,
      content: newContent,
      branch: BRANCH,
      committer: { name: "Gemini-Lab Bot", email: "nitrogen68@users.noreply.github.com" },
      author: { name: "Gemini-Lab Bot", email: "nitrogen68@users.noreply.github.com" },
    };
    if (sha) putBody.sha = sha;

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
      throw new Error(err.message || "GitHub error");
    }

    return res.status(200).json({
      success: true,
      hits: currentData.total,
      pageHits: currentData.pages[slug],
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
