import "dotenv/config";
import cron from "node-cron";
import { readFileSync } from "fs";
import { searchTrendingPosts } from "./trending.js";
import { sendLineNotification } from "./line.js";
import { filterNewPosts } from "./store.js";

const CONFIG = JSON.parse(readFileSync(new URL("../config.json", import.meta.url), "utf-8"));

function validateEnv() {
  const required = ["XAI_API_KEY"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`必須の環境変数が未設定です: ${missing.join(", ")}`);
    console.error(".env.example を参考に .env ファイルを作成してください");
    process.exit(1);
  }

  const lineKeys = ["LINE_CHANNEL_ACCESS_TOKEN", "LINE_USER_ID"];
  const lineMissing = lineKeys.filter((key) => !process.env[key]);
  if (lineMissing.length > 0) {
    console.warn(`LINE通知は無効です（未設定: ${lineMissing.join(", ")}）`);
    console.warn("コンソールにのみ結果を表示します\n");
  }
}

async function run() {
  const now = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  console.log(`\n[${now}] 検索開始...`);

  try {
    const posts = await searchTrendingPosts();
    console.log(`[検索結果] バズ投稿: ${posts.length}件`);

    const newPosts = filterNewPosts(posts);
    console.log(`[フィルタ] 新規投稿: ${newPosts.length}件`);

    if (newPosts.length > 0) {
      // コンソールに表示
      for (const p of newPosts) {
        console.log(`  📢 ${p.keyword_label} | ${p.author} | ❤️${p.likes ?? "?"} 🔁${p.retweets ?? "?"}`);
        console.log(`     ${p.text.slice(0, 80)}`);
        console.log(`     ${p.url}`);
      }

      // LINE通知（設定されていれば）
      if (process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_USER_ID) {
        await sendLineNotification(
          newPosts,
          process.env.LINE_CHANNEL_ACCESS_TOKEN,
          process.env.LINE_USER_ID
        );
        console.log(`[完了] ${newPosts.length}件をLINEに通知しました`);
      } else {
        console.log(`[完了] ${newPosts.length}件を検出（LINE未設定のためコンソールのみ）`);
      }
    } else {
      console.log("[完了] 新しいバズ投稿はありませんでした");
    }
  } catch (err) {
    console.error("[エラー]", err.message);
  }
}

validateEnv();

console.log("=".repeat(50));
console.log("🔥 Trending Post Notifier (Grok-powered)");
console.log(`   キーワード: ${CONFIG.keywords.map((k) => k.label).join(", ")}`);
console.log(`   閾値: ❤️ ${CONFIG.thresholds.min_likes}+ / 🔁 ${CONFIG.thresholds.min_retweets}+`);
console.log(`   スケジュール: ${CONFIG.schedule.description}`);
console.log(`   検索エンジン: Grok (xAI API + x_search)`);
console.log("=".repeat(50));

// 起動時に1回実行
await run();

// スケジュール実行
cron.schedule(CONFIG.schedule.cron, run);
console.log(`\nスケジューラ起動中 (${CONFIG.schedule.cron})... Ctrl+C で停止`);
