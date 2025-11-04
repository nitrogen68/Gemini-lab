// === /api/updateHits.js ===
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const API_URL = "https://api.github.com/repos/nitrogen68/Gemini-lab/contents/data/hits.json";

    // Ambil file lama
    const getRes = await fetch(API_URL, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json"
      },
    });

    const existing = getRes.ok ? await getRes.json() : null;
    let currentHits = 0;
    let sha = undefined;

    if (existing && existing.content) {
      const decoded = Buffer.from(existing.content, "base64").toString("utf-8");
      const parsed = JSON.parse(decoded);
      currentHits = parsed.hits || 0;
      sha = existing.sha;
    }

    const newData = {
      hits: currentHits + 1,
      updated: new Date().toISOString(),
    };

    // PUT update ke GitHub
    const putRes = await fetch(API_URL, {
      method: "PUT",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github.v3+json"
      },
      body: JSON.stringify({
        message: "update hits.json otomatis",
        content: Buffer.from(JSON.stringify(newData, null, 2)).toString("base64"),
        sha,
      }),
    });

    if (!putRes.ok) throw new Error(`Gagal update: ${putRes.status}`);

    return res.status(200).json({
      success: true,
      hits: newData.hits,
      updated: newData.updated
    });
  } catch (err) {
    console.error("Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
