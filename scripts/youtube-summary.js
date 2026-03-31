import { fetchTranscript } from "youtube-transcript";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";

dotenv.config();

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = "claude-sonnet-4-6";

function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function formatTimestamp(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

async function getTranscript(videoId) {
  try {
    const transcriptItems = await fetchTranscript(videoId, {
      lang: "ja",
    });
    if (!transcriptItems || transcriptItems.length === 0) {
      throw new Error("字幕が見つかりませんでした");
    }
    return transcriptItems;
  } catch (e) {
    // 日本語字幕がなければ英語を試す
    try {
      const transcriptItems = await fetchTranscript(videoId, {
        lang: "en",
      });
      return transcriptItems;
    } catch {
      throw new Error(
        `文字起こしの取得に失敗しました: ${e.message}\n字幕が利用できない動画の可能性があります。`
      );
    }
  }
}

function formatTranscript(items) {
  return items
    .map((item) => `[${formatTimestamp(item.offset)}] ${item.text}`)
    .join("\n");
}

async function summarizeWithSonnet(transcript, url) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `以下はYouTube動画（${url}）の文字起こしです。この内容を分析して、以下の形式で日本語で出力してください。

## 📝 要約
動画の内容を3〜5文で簡潔に要約してください。

## 🔑 キーポイント
動画の重要なポイントを箇条書きで5〜10個挙げてください。タイムスタンプがあれば付けてください。

## 💡 主な学び・インサイト
この動画から得られる重要な学びやインサイトを3〜5個挙げてください。

## 🏷️ カテゴリ・タグ
この動画に適したカテゴリやタグを5個程度提案してください。

---
文字起こし:
${transcript}`,
      },
    ],
  });

  return response.content[0].text;
}

async function main() {
  const url = process.argv[2];

  if (!url) {
    console.error("使い方: node scripts/youtube-summary.js <YouTube URL>");
    console.error("例: node scripts/youtube-summary.js https://www.youtube.com/watch?v=xxxxx");
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("エラー: ANTHROPIC_API_KEY が設定されていません。.envファイルを確認してください。");
    process.exit(1);
  }

  const videoId = extractVideoId(url);
  if (!videoId) {
    console.error("エラー: 有効なYouTube URLではありません。");
    process.exit(1);
  }

  console.log(`\n🎬 動画ID: ${videoId}`);
  console.log(`🔗 URL: ${url}`);
  console.log(`🤖 モデル: ${MODEL} (コスト節約のためSonnetを使用)\n`);

  // 文字起こし取得
  console.log("📥 文字起こしを取得中...");
  const transcriptItems = await getTranscript(videoId);
  const transcript = formatTranscript(transcriptItems);
  console.log(`✅ 文字起こし完了 (${transcriptItems.length}セグメント)\n`);

  // 文字起こし表示
  console.log("=".repeat(60));
  console.log("📄 文字起こし");
  console.log("=".repeat(60));
  console.log(transcript);
  console.log("\n");

  // Sonnetで要約・分析
  console.log("🧠 Sonnetで要約・分析中...");
  const summary = await summarizeWithSonnet(transcript, url);
  console.log("\n" + "=".repeat(60));
  console.log("📊 要約・分析結果");
  console.log("=".repeat(60));
  console.log(summary);
  console.log("\n");
}

main().catch((err) => {
  console.error("エラーが発生しました:", err.message);
  process.exit(1);
});
