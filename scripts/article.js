/**
 * Grok (xAI API) + x_search で恋愛系の「今バズっているX記事」をリサーチし、
 * そのまま投稿できるX記事ドラフト + セルフ引用案を生成する。
 *
 * 「X記事を量産してバズらせ、noteへ誘導する」戦略の作業時間を
 * 1日15分に圧縮するための核。リサーチと初稿生成をまとめて1回で行う。
 *
 * Usage:
 *   node scripts/article.js --niche 復縁
 *   node scripts/article.js --niche 不倫 --count 3 --note "https://note.com/xxx/n/abc"
 *   node scripts/article.js --niche マチアプ攻略 --hours 72 --dry-run
 */

import "dotenv/config";
import { writeFileSync, mkdirSync } from "fs";
import { join, relative } from "path";
import { callGrok } from "../src/grok.js";

const DEFAULTS = {
  niche: "復縁",
  count: 3,
  hours: 72,
  note: "",
  outDir: "data/articles",
};

// 記事中の鉄板ジャンル。--niche はこの中から選ぶのが基本だが任意文字列も可。
const NICHES = [
  "復縁",
  "回避",
  "不倫",
  "婚外恋愛",
  "マチアプ攻略",
  "婚活攻略",
  "セクテク",
  "ナンパ",
  "キャバ嬢攻略",
];

function parseArgs(argv) {
  const args = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => (i + 1 < argv.length ? argv[++i] : "");
    if (a === "--niche") args.niche = next() || DEFAULTS.niche;
    else if (a === "--count") args.count = Number(next()) || DEFAULTS.count;
    else if (a === "--hours") args.hours = Number(next()) || DEFAULTS.hours;
    else if (a === "--note") args.note = next();
    else if (a === "--out-dir") args.outDir = next() || args.outDir;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "-h" || a === "--help") {
      console.log(`Usage:
  node scripts/article.js --niche 復縁

Options:
  --niche TEXT   ジャンル (default: "復縁")
                 鉄板: ${NICHES.join(" / ")}
  --count N      生成するX記事ドラフト数 (default: 3)
  --hours N      バズ事例を遡る時間 (default: 72)
  --note URL     CTAに差し込むnoteのURL (任意)
  --out-dir DIR  出力先 (default: data/articles)
  --dry-run      プロンプトを表示して終了`);
      process.exit(0);
    }
  }
  return args;
}

function buildPrompt(cfg) {
  const since = new Date(Date.now() - cfg.hours * 3600000).toISOString().split("T")[0];
  const today = new Date().toISOString().split("T")[0];

  const cta = cfg.note
    ? `「続き / 具体的なやり方はこちら → ${cfg.note}」の形で、最後に1行のCTAを必ず入れる。`
    : `最後に「続き / 具体的なやり方はnoteにまとめた（リンクは下）」という形のCTAプレースホルダ（[NOTE_LINK]）を1行入れる。`;

  return `日本語で回答して。

目的: 恋愛系ジャンル「${cfg.niche}」で、X(Twitter)の「記事（長文ポスト）」をバズらせ、noteの低単価商品へ誘導する。
そのための (A) 今のバズ傾向のリサーチ と (B) すぐ投稿できるX記事ドラフト${cfg.count}本 を作る。

# 前提
- アカウント: フォロワーが少ない個人でも再現できる前提で書く（影響力に依存しない）
- 期間: ${since} 〜 ${today}（直近 ${cfg.hours} 時間を目安）
- 日本語圏のX投稿を優先的に検索する
- 「あるある」「共感」「秘匿性（他では見られない）」「ターゲティング（〜な人は見て）」が刺さりやすい

# やること(A): リサーチ（空気を拾う）
1) 「${cfg.niche}」周辺で、フォロワー100〜1万規模なのに外れ値のimpを出している記事/ポストを探す。
   - 広めのクエリを8個以上自分で作ってX検索する
   - 可能なら検索オペレータでバズを拾う（例: min_faves:300, min_retweets:50, since:${since}）。使えない場合はその旨を明記し、候補を多めに拾って上位を選ぶ
2) 繰り返し出てくる「刺さっている切り口/言い回し/感情」を3-5クラスターに整理する（単発はクラスターにしない）。
3) 各クラスターに代表ポストのURLを2つずつ付ける（長文の直接引用はしない。要約のみ）。

# やること(B): X記事ドラフトを${cfg.count}本生成
各ドラフトは、以下の「教育7割・答え1割・マインド2割」の構成に必ず従う:
  1. フック（刺激的 or 「なんかおもろそう」と思わせる1〜2行。タイトル相当）
  2. 共感/理想の未来 or 失敗のあるある（読み手を「自分のことだ」と引き込む）
  3. ちょっとだけ答え（核心は出し惜しみ。「気づき」を1個だけ渡す）
  4. 理想の未来 / なぜそれが効くか（マインド・原理）
  5. CTA: ${cta}

各ドラフトごとに、以下を必ず出す:
- タイトル案（フック。3パターン）
- 本文（そのまま投稿できる完成形。1本あたり600〜1200字程度。改行を多めに、スマホで読みやすく）
- ターゲット（誰の・どの瞬間の痛みに刺すか、1行）
- なぜ伸びる仮説（2つまで）
- セルフ引用案 3本（記事を自分で引用RPして伸ばすための短文。各1〜2文。型を変える:
    ・ターゲティング型「〜な人はまじで見てほしい」
    ・秘匿性型「これは他では見ない / 目から鱗だった」
    ・続き気になる型「この記事の3つ目が一番ヤバい」 など)

# 制約・トーン
- 誇大広告・断定的な効果保証（「絶対別れた相手が戻る」等）は禁止。あくまで考え方・テクニックとして書く
- 実在の個人を特定・中傷しない。プライバシーに踏み込みすぎない
- 違法・有害行為（盗撮、ストーカー、同意のない行為の助長など）は書かない。健全な恋愛テクニックの範囲にとどめる
- 過度に露骨な性的描写はしない（示唆・あるあるの範囲）

# 出力形式
1) 「今バズっている切り口（クラスター）」を3-5個、各クラスターに代表URL2つ
2) 「今日狙うべき切り口 ベスト3」
3) 「X記事ドラフト」を番号付きで${cfg.count}本（上記の各項目を含む）
4) 最後に、参考にしたURLだけの一覧
`;
}

function timestampSlug(d) {
  return d.toISOString().replace(/[-:]/g, "").replace("T", "_").slice(0, 16) + "Z";
}

function nicheSlug(niche) {
  return niche.replace(/[^0-9A-Za-zぁ-んァ-ヶ一-龠ー]/g, "").slice(0, 16) || "niche";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const prompt = buildPrompt(args);

  if (args.dryRun) {
    console.log(prompt);
    return;
  }

  console.log(`[記事] ジャンル: "${args.niche}"`);
  console.log(`[記事] 直近 ${args.hours} 時間のバズをリサーチし、${args.count}本のドラフトを生成中...`);

  const { raw, text } = await callGrok(prompt);

  const now = new Date();
  const ts = timestampSlug(now);
  const slug = nicheSlug(args.niche);

  mkdirSync(args.outDir, { recursive: true });

  const mdPath = join(args.outDir, `${ts}_${slug}_article.md`);
  const md = `# X記事ドラフト: ${args.niche}\n\n- Timestamp: ${now.toISOString()}\n- Niche: ${args.niche}\n- Count: ${args.count}\n- Hours: ${args.hours}\n- Note: ${args.note || "(未指定 / [NOTE_LINK] を差し替えて使う)"}\n\n---\n\n${text}\n`;
  writeFileSync(mdPath, md);

  const jsonPath = join(args.outDir, `${ts}_${slug}_article.json`);
  writeFileSync(jsonPath, JSON.stringify({
    timestamp: now.toISOString(),
    niche: args.niche,
    params: { count: args.count, hours: args.hours, note: args.note },
    response: raw,
    extracted_text: text,
  }, null, 2));

  console.log(`\n[保存] ${relative(process.cwd(), mdPath)}`);
  console.log(`[保存] ${relative(process.cwd(), jsonPath)}`);
  console.log(`\n--- X記事ドラフト ---\n`);
  console.log(text);
}

main().catch((err) => {
  console.error(String(err));
  process.exit(1);
});
