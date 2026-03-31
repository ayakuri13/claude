import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";

dotenv.config();

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = "claude-sonnet-4-6";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

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

function decodeEntities(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec) =>
      String.fromCodePoint(parseInt(dec, 10))
    );
}

function parseTranscriptXml(xml) {
  const results = [];
  // Try <text start="..." dur="...">...</text> format
  const textRegex = /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g;
  let match;
  while ((match = textRegex.exec(xml)) !== null) {
    results.push({
      offset: parseFloat(match[1]) * 1000,
      duration: parseFloat(match[2]) * 1000,
      text: decodeEntities(match[3]).trim(),
    });
  }
  if (results.length > 0) return results;

  // Try <p t="ms" d="ms"> format
  const pRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  while ((match = pRegex.exec(xml)) !== null) {
    let text = match[3];
    // Extract text from <s> tags if present
    const sRegex = /<s[^>]*>([^<]*)<\/s>/g;
    let sText = "";
    let sMatch;
    while ((sMatch = sRegex.exec(text)) !== null) {
      sText += sMatch[1];
    }
    text = sText || text.replace(/<[^>]+>/g, "");
    text = decodeEntities(text).trim();
    if (text) {
      results.push({
        offset: parseInt(match[1], 10),
        duration: parseInt(match[2], 10),
        text,
      });
    }
  }
  return results;
}

async function fetchTranscriptViaInnerTube(videoId, lang) {
  const response = await fetch(
    "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "com.google.android.youtube/20.10.38 (Linux; U; Android 14)",
      },
      body: JSON.stringify({
        context: {
          client: { clientName: "ANDROID", clientVersion: "20.10.38" },
        },
        videoId,
      }),
    }
  );
  if (!response.ok) return null;

  const data = await response.json();
  const tracks =
    data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!Array.isArray(tracks) || tracks.length === 0) return null;

  const track = lang
    ? tracks.find((t) => t.languageCode === lang) || tracks[0]
    : tracks[0];

  const xmlResponse = await fetch(track.baseUrl, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!xmlResponse.ok) return null;

  const xml = await xmlResponse.text();
  return parseTranscriptXml(xml);
}

async function fetchTranscriptViaWebPage(videoId, lang) {
  const response = await fetch(
    `https://www.youtube.com/watch?v=${videoId}`,
    {
      headers: {
        "User-Agent": USER_AGENT,
        ...(lang && { "Accept-Language": lang }),
      },
    }
  );
  const html = await response.text();

  if (html.includes('class="g-recaptcha"')) {
    throw new Error("YouTubeからCAPTCHAを要求されています。時間を置いて再試行してください。");
  }

  // Extract ytInitialPlayerResponse
  const marker = "var ytInitialPlayerResponse = ";
  const startIdx = html.indexOf(marker);
  if (startIdx === -1) throw new Error("動画情報を取得できませんでした");

  const jsonStart = startIdx + marker.length;
  let depth = 0;
  let endIdx = jsonStart;
  for (let i = jsonStart; i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") {
      depth--;
      if (depth === 0) {
        endIdx = i + 1;
        break;
      }
    }
  }

  const playerData = JSON.parse(html.slice(jsonStart, endIdx));
  const tracks =
    playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

  if (!Array.isArray(tracks) || tracks.length === 0) {
    throw new Error("この動画には字幕がありません");
  }

  const track = lang
    ? tracks.find((t) => t.languageCode === lang) || tracks[0]
    : tracks[0];

  const xmlResponse = await fetch(track.baseUrl, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!xmlResponse.ok) throw new Error("字幕データの取得に失敗しました");

  const xml = await xmlResponse.text();
  return parseTranscriptXml(xml);
}

async function getTranscript(videoId) {
  // InnerTube API を試す（日本語優先）
  let items = await fetchTranscriptViaInnerTube(videoId, "ja");
  if (items && items.length > 0) return items;

  // InnerTube API（言語指定なし）
  items = await fetchTranscriptViaInnerTube(videoId, null);
  if (items && items.length > 0) return items;

  // Webページから取得（フォールバック）
  try {
    items = await fetchTranscriptViaWebPage(videoId, "ja");
    if (items && items.length > 0) return items;
  } catch {
    // ignore
  }

  items = await fetchTranscriptViaWebPage(videoId, "en");
  if (items && items.length > 0) return items;

  throw new Error("字幕を取得できませんでした。字幕が利用できない動画の可能性があります。");
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
