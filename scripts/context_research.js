/**
 * Grok (xAI API) + x_search で周辺リサーチを行い、Context Pack を作成する。
 *
 * Usage:
 *   node scripts/context_research.js --topic "ClaudeにX検索を足してリサーチを自動化する"
 *   node scripts/context_research.js --topic "AI agent trends" --locale global --audience both
 */

import "dotenv/config";
import { writeFileSync, mkdirSync } from "fs";
import { join, relative } from "path";
import { callGrok } from "../src/grok.js";

const DEFAULTS = {
  locale: "ja",
  audience: "engineer",
  goal: "記事を深くするための周辺情報リサーチ（一次情報/用語/反論/数字を揃える）",
  days: 30,
  outDir: "data/context-research",
};

function parseArgs(argv) {
  const args = { ...DEFAULTS, topic: "", dryRun: false };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => (i + 1 < argv.length ? argv[++i] : "");
    if (a === "--topic") args.topic = next();
    else if (a === "--locale") args.locale = next() === "global" ? "global" : "ja";
    else if (a === "--audience") {
      const v = next();
      args.audience = ["investor", "both"].includes(v) ? v : "engineer";
    }
    else if (a === "--goal") args.goal = next() || args.goal;
    else if (a === "--days") args.days = Number(next()) || 30;
    else if (a === "--out-dir") args.outDir = next() || args.outDir;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "-h" || a === "--help") {
      console.log(`Usage:
  node scripts/context_research.js --topic "..."

Options:
  --topic TEXT       調べたいトピック (必須)
  --locale L         ja or global (default: ja)
  --audience A       engineer / investor / both (default: engineer)
  --goal TEXT        リサーチの目的
  --days N           遡る日数 (default: 30)
  --out-dir DIR      出力先 (default: data/context-research)
  --dry-run          プロンプトを表示して終了`);
      process.exit(0);
    }
  }
  return args;
}

function buildPrompt(args) {
  const now = new Date();

  const localeLine =
    args.locale === "ja"
      ? "検索・収集は日本語圏を優先（日本語で読める一次情報や日本語で拡散している情報）。必要なら英語一次情報も併用。"
      : "検索・収集はグローバル一次情報（英語中心）を優先。日本語圏の派生/解説も拾ってよい。";

  const audienceMap = {
    engineer: "読者はエンジニア寄り。実装・運用・制約（レート/コスト/権限）を厚めに。",
    investor: "読者は投資家寄り。評価軸（コスト/優位性/リスク/規約）を厚めに。ただし投資助言はしない。",
    both: "読者は投資家+エンジニア。両方に通じる共通言語（運用/再現性/コスト/監査）で整理。",
  };

  return `日本語で回答して。

目的: ${args.goal}
トピック: ${args.topic}
時点: ${now.toISOString()}
検索窓の目安: 直近${args.days}日（ただし仕様/規約/料金は最新を優先）

前提:
- ${localeLine}
- ${audienceMap[args.audience]}
- 数字/仕様/制限は捏造しない。不明は unknown と書く。
- 仕様/価格/レート等は変更され得るので、必ず「As of（参照日）」を付ける。
- 長文の直接引用はしない（要旨で）。
- 投資助言に見える表現は禁止（買い/売り推奨、価格目標、倍化など）。
- 重要: Primary Sources は「公式ドキュメント/公式ブログ/仕様/規約/料金/公式GitHub」など、X投稿以外のURLにする。X投稿URLは Secondary としてのみ可。
- 出力に専用タグ（render_inline_citation など）を入れない。URLは素のURLで書く。

やること:
1) x_search を使って一次情報（公式ドキュメント/仕様/規約/料金/公式ブログ/公式GitHub）を最優先で集める
2) 次に実装例（GitHub、SDK、サンプル）を集める
3) 反論/注意点を最低1つ作る（例: レート制限、コスト爆発、偏り、ポリシー違反、セキュリティ）
4) 記事が深くなる要素を最低2つ作る:
   - 用語の定義（誤解を潰す）
   - datedな数字（レート/料金/制約など）
   - 実装の最小構成（必要な権限、保存形式、ログ）

出力形式（Markdown、以下の見出しを必ず含める）:
- Meta（Timestamp, Topic, Audience, Voice）
- Topic (1 sentence)
- Why Now (3 bullets)
- Key Questions (5-8)
- Terminology / Definitions（Source付き）
- Primary Sources（URL）
- Secondary Sources（URL）
- Contrasts / Counterpoints（Evidence付き）
- Data Points (dated)（As of, Source付き）
- What We Can Safely Say / What We Should Not Say
- Suggested Angles (3)
- Outline Seeds (3-6 headings)
- Sources (URL list)
`;
}

function timestampSlug(d) {
  return d.toISOString().replace(/[-:]/g, "").replace("T", "_").slice(0, 16) + "Z";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.topic) {
    console.error('--topic が必要です。例: --topic "AIエージェントのトレンド"');
    process.exit(2);
  }

  const prompt = buildPrompt(args);

  if (args.dryRun) {
    console.log(prompt);
    return;
  }

  console.log(`[リサーチ] トピック: "${args.topic}"`);
  console.log(`[リサーチ] Grok (x_search) に問い合わせ中...`);

  const { raw, text } = await callGrok(prompt);

  const now = new Date();
  const ts = timestampSlug(now);
  const base = `${ts}_${args.locale}_context`;

  mkdirSync(args.outDir, { recursive: true });

  const md = `# Context Pack (${args.locale})\n\n## Meta\n- Timestamp (UTC): ${now.toISOString()}\n- Topic: ${args.topic}\n- Audience: ${args.audience}\n\n---\n\n${text}\n`;

  const jsonPath = join(args.outDir, `${base}.json`);
  writeFileSync(jsonPath, JSON.stringify({
    timestamp: now.toISOString(),
    topic: args.topic,
    params: { locale: args.locale, audience: args.audience, goal: args.goal, days: args.days },
    response: raw,
    extracted_text: text,
  }, null, 2));

  const txtPath = join(args.outDir, `${base}.txt`);
  writeFileSync(txtPath, text);

  const mdPath = join(args.outDir, `${ts}_context.md`);
  writeFileSync(mdPath, md);

  console.log(`\n[保存] ${relative(process.cwd(), jsonPath)}`);
  console.log(`[保存] ${relative(process.cwd(), txtPath)}`);
  console.log(`[保存] ${relative(process.cwd(), mdPath)}`);
  console.log(`\n--- Context Pack ---\n`);
  console.log(text);
}

main().catch((err) => {
  console.error(String(err));
  process.exit(1);
});
