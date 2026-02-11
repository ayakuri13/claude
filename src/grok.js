/**
 * xAI (Grok) API クライアント
 * x_search ツールを使って X(Twitter) をリアルタイム検索する
 */

const DEFAULT_BASE_URL = "https://api.x.ai";
const DEFAULT_MODEL = "grok-3-fast";
const TIMEOUT_MS = 180_000;

export function getGrokConfig() {
  return {
    apiKey: process.env.XAI_API_KEY || "",
    baseUrl: (process.env.XAI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ""),
    model: process.env.XAI_MODEL || DEFAULT_MODEL,
  };
}

export async function callGrok(prompt, options = {}) {
  const cfg = getGrokConfig();
  if (!cfg.apiKey) {
    throw new Error("XAI_API_KEY が未設定です。.env ファイルを確認してください。");
  }

  const model = options.model || cfg.model;
  const url = `${cfg.baseUrl}/v1/responses`;

  const payload = {
    model,
    input: prompt,
    tools: [{ type: "x_search" }],
  };

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: ac.signal,
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`xAI API エラー (${res.status}): ${text.slice(0, 2000)}`);
    }

    const json = JSON.parse(text);
    return { raw: json, text: extractText(json) };
  } finally {
    clearTimeout(timer);
  }
}

function extractText(resp) {
  if (resp && typeof resp === "object") {
    const out = resp.output;
    if (Array.isArray(out)) {
      const parts = [];
      for (const item of out) {
        if (!item || typeof item !== "object") continue;
        const content = item.content;
        if (!Array.isArray(content)) continue;
        for (const c of content) {
          if (c && typeof c === "object" && typeof c.text === "string" && c.text.trim()) {
            parts.push(c.text);
          }
        }
      }
      if (parts.length) return parts.join("\n").trim();
    }
    for (const k of ["output_text", "text", "content"]) {
      if (typeof resp[k] === "string" && resp[k].trim()) return resp[k].trim();
    }
  }
  return JSON.stringify(resp, null, 2);
}
