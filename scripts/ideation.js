/**
 * Grok (xAI API) + x_search で X のタイムラインからバズ投稿ネタを抽出する。
 * ブログ記事中のプロンプト（空気を拾うための探索手順）を実装したもの。
 *
 * Usage:
 *   node scripts/ideation.js --topic "AI / Web3"
 *   node scripts/ideation.js --topic "Claude Code" --count 10 --hours 48
 */

import "dotenv/config";
import { writeFileSync, mkdirSync } from "fs";
import { join, relative } from "path";
import { callGrok } from "../src/grok.js";

const DEFAULTS = {
  topic: "AI / Web3",
  count: 8,
  hours: 24,
  locale: "ja",
  audience: "both",
  outDir: "data/ideation",
};

function parseArgs(argv) {
  const args = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => (i + 1 < argv.length ? argv[++i] : "");
    if (a === "--topic") args.topic = next();
    else if (a === "--count") args.count = Number(next()) || DEFAULTS.count;
    else if (a === "--hours") args.hours = Number(next()) || DEFAULTS.hours;
    else if (a === "--locale") args.locale = next() === "global" ? "global" : "ja";
    else if (a === "--audience") {
      const v = next();
      args.audience = ["investor", "engineer", "both"].includes(v) ? v : "both";
    }
    else if (a === "--out-dir") args.outDir = next() || args.outDir;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "-h" || a === "--help") {
      console.log(`Usage:
  node scripts/ideation.js --topic "AI / Web3"

Options:
  --topic TEXT       領域 (default: "AI / Web3")
  --count N          素材数 (default: 8)
  --hours N          遡る時間 (default: 24)
  --locale L         ja or global (default: ja)
  --audience A       engineer / investor / both (default: both)
  --out-dir DIR      出力先 (default: data/ideation)
  --dry-run          プロンプトを表示して終了`);
      process.exit(0);
    }
  }
  return args;
}

function buildPrompt(cfg) {
  const now = new Date();
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const today = now.toISOString().split("T")[0];

  const localeBlock =
    cfg.locale === "ja"
      ? "\n- 日本語圏のX投稿を優先的に検索。必要に応じて英語圏も。"
      : "\n- グローバル（英語中心）のX投稿を検索。日本語の派生も可。";

  const audienceMap = {
    engineer: "エンジニア向け",
    investor: "投資家向け",
    both: "投資家 + エンジニア向け",
  };

  return `日本語で回答して。

目的: X(Twitter)でimpressionsを最大化するための投稿ネタ出し。
前提:
- アカウント: 個人発信
- 想定読者: ${audienceMap[cfg.audience]}
- 領域: ${cfg.topic}
- 文体: 常体、ストーリー薄め、結論先出し
- 期間: 「昨日と今日」= ${yesterday} と ${today}（直近 ${cfg.hours} 時間を目安）${localeBlock}

やること（重要: 空気を拾うための探索手順）:
1) まず「広く薄く」探索して、タイムラインの空気（論点のクラスター）を抽出する:
   - ${cfg.topic} の文脈に対して、広めのクエリを12個以上自分で作って X 検索する
   - 収集した投稿から「繰り返し出てくる固有名詞/機能名/言い回し」を抽出し、3-5クラスターにまとめる（単発の話題はクラスターにしない）
   - さらに、上で抽出した「繰り返し出てくる機能名/短いフレーズ」を2-5個選び、それをクエリとして追加検索して補強する
   - 可能ならXの検索オペレータを使って「バズ」を拾う（例: min_faves:500, min_retweets:100, since:${yesterday}）。使えない場合は、その旨を明記して代替手段（候補を多めに拾って上位を選ぶ）に切り替える
2) 次に、クラスターごとに代表ポストを2つずつ選ぶ（長文の直接引用はしない）。
3) その後、合計${cfg.count}件の「素材」を出す。
4) 各素材ごとに以下を必ず出す:
- url（Xの投稿URL。無ければ一次情報URL）
- 要約（1-2行、自分の言葉）
- エンゲージ指標（観測できたものだけ。例: likes=?, retweets=?, replies=?, views=?。不明は unknown）
- なぜ伸びたか（仮説を3つまで）
- ここから作れる投稿ネタ案（投資家向け1つ、エンジニア向け1つ）
- フック案（1行を3つ）
- 注意（断定/投資助言に見えない言い回しへ調整点があれば1行）

追加の要求（空気感を出す）:
- 最初に「タイムラインの空気（論点のクラスター）」を3-5個、各クラスターに代表ポストURLを2つずつ付ける
- その上で「投稿者が使っている言い回し/キーフレーズ」を各クラスターにつき2-3個（そのまま引用せず、短い言い換えで）
- 不確かなゴシップは避け、一次情報/公式発表/本人発言を優先する。裏が取れない場合は「未確認」と明記する
- 投資助言に見える表現は禁止（買い/売り推奨、株価や価格の目標・倍化など）。投資家向けネタ案は「論点/評価軸/事業インパクト」の形で書く

出力形式:
- 最初に「タイムラインの空気（論点のクラスター）」を箇条書き
- 次に「今日の結論（狙うべき3テーマ）」を箇条書き
- 次に「素材一覧」を番号付きで${cfg.count}件
- 最後に url だけの一覧をまとめて
`;
}

function timestampSlug(d) {
  return d.toISOString().replace(/[-:]/g, "").replace("T", "_").slice(0, 16) + "Z";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const prompt = buildPrompt(args);

  if (args.dryRun) {
    console.log(prompt);
    return;
  }

  console.log(`[ネタ出し] 領域: "${args.topic}"`);
  console.log(`[ネタ出し] 直近 ${args.hours} 時間のXを探索中...`);

  const { raw, text } = await callGrok(prompt);

  const now = new Date();
  const ts = timestampSlug(now);

  mkdirSync(args.outDir, { recursive: true });

  const mdPath = join(args.outDir, `${ts}_ideation.md`);
  const md = `# Ideation Report\n\n- Timestamp: ${now.toISOString()}\n- Topic: ${args.topic}\n- Count: ${args.count}\n- Hours: ${args.hours}\n\n---\n\n${text}\n`;
  writeFileSync(mdPath, md);

  const jsonPath = join(args.outDir, `${ts}_ideation.json`);
  writeFileSync(jsonPath, JSON.stringify({
    timestamp: now.toISOString(),
    topic: args.topic,
    params: { count: args.count, hours: args.hours, locale: args.locale, audience: args.audience },
    response: raw,
    extracted_text: text,
  }, null, 2));

  console.log(`\n[保存] ${relative(process.cwd(), mdPath)}`);
  console.log(`[保存] ${relative(process.cwd(), jsonPath)}`);
  console.log(`\n--- Ideation Report ---\n`);
  console.log(text);
}

main().catch((err) => {
  console.error(String(err));
  process.exit(1);
});
