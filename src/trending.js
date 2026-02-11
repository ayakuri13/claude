/**
 * Grok にバズ投稿を検索させるプロンプトとパーサー
 */

import { readFileSync } from "fs";
import { callGrok } from "./grok.js";

const CONFIG = JSON.parse(readFileSync(new URL("../config.json", import.meta.url), "utf-8"));

function buildTrendingPrompt(keyword) {
  const now = new Date();
  const hoursAgo = CONFIG.search.hours_ago || 24;
  const minLikes = CONFIG.thresholds.min_likes;
  const minRetweets = CONFIG.thresholds.min_retweets;
  const lang = CONFIG.search.lang === "ja" ? "日本語" : "すべての言語";

  return `日本語で回答してください。

あなたはX(Twitter)のトレンド分析の専門家です。
x_search を使って、以下の条件でバズっている投稿を検索してください。

検索キーワード: ${keyword.query}
言語: ${lang}
期間: 直近${hoursAgo}時間以内
バズの基準: いいね${minLikes}以上 または リツイート${minRetweets}以上

可能であれば、Xの検索オペレータを活用してください:
- min_faves:${minLikes}
- min_retweets:${minRetweets}
- since:${new Date(Date.now() - hoursAgo * 3600000).toISOString().split("T")[0]}

検索オペレータが使えない場合は、候補を多めに拾って上位を選んでください。

重要: 以下のJSON形式で結果を返してください。JSON以外のテキストは出力しないでください。
投稿が見つからない場合は空配列 [] を返してください。

\`\`\`json
[
  {
    "id": "ツイートID（わかれば）",
    "url": "https://x.com/ユーザー名/status/ツイートID",
    "text": "投稿の要約（50-100文字）",
    "author": "表示名 (@ユーザー名)",
    "likes": 数値またはnull,
    "retweets": 数値またはnull,
    "replies": 数値またはnull,
    "why_trending": "なぜバズったかの仮説（1行）"
  }
]
\`\`\`

最大${CONFIG.search.max_results_per_query || 10}件まで。エンゲージメントが高い順に並べてください。
数値が不明な場合はnullにしてください。URLは必ず含めてください。`;
}

function parseGrokResponse(text) {
  // JSON配列を抽出（Grokの回答にはテキストが混ざることがある）
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const posts = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(posts)) return [];

    return posts
      .filter((p) => p && p.url)
      .map((p) => ({
        id: p.id || p.url?.split("/").pop() || "",
        url: p.url,
        text: p.text || "",
        author: p.author || "不明",
        likes: typeof p.likes === "number" ? p.likes : null,
        retweets: typeof p.retweets === "number" ? p.retweets : null,
        replies: typeof p.replies === "number" ? p.replies : null,
        why_trending: p.why_trending || "",
        keyword_label: "",
      }));
  } catch {
    return [];
  }
}

export async function searchTrendingPosts() {
  const allPosts = [];

  for (const keyword of CONFIG.keywords) {
    console.log(`[Grok] "${keyword.label}" を検索中...`);

    try {
      const prompt = buildTrendingPrompt(keyword);
      const { text } = await callGrok(prompt);
      const posts = parseGrokResponse(text);

      for (const p of posts) {
        p.keyword_label = keyword.label;
      }

      console.log(`[Grok] "${keyword.label}": ${posts.length}件のバズ投稿を検出`);
      allPosts.push(...posts);
    } catch (err) {
      console.error(`[Grok] "${keyword.label}" の検索でエラー: ${err.message}`);
    }
  }

  // URL で重複排除
  const seen = new Set();
  const unique = allPosts.filter((p) => {
    if (seen.has(p.url)) return false;
    seen.add(p.url);
    return true;
  });

  // エンゲージメント順にソート
  unique.sort((a, b) => ((b.likes || 0) + (b.retweets || 0)) - ((a.likes || 0) + (a.retweets || 0)));

  return unique;
}
