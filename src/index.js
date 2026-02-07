import "dotenv/config";
import cron from "node-cron";
import { readFileSync } from "fs";
import { searchTrendingPosts } from "./twitter.js";
import { sendLineNotification } from "./line.js";
import { filterNewPosts } from "./store.js";

const CONFIG = JSON.parse(readFileSync(new URL("../config.json", import.meta.url), "utf-8"));

function validateEnv() {
  const required = ["X_BEARER_TOKEN", "LINE_CHANNEL_ACCESS_TOKEN", "LINE_USER_ID"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`必須の環境変数が未設定です: ${missing.join(", ")}`);
    console.error(".env.example を参考に .env ファイルを作成してください");
    process.exit(1);
  }
}

async function run() {
  const now = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  console.log(`\n[${now}] 検索開始...`);

  try {
    const posts = await searchTrendingPosts(process.env.X_BEARER_TOKEN);
    console.log(`[検索結果] バズ投稿: ${posts.length}件`);

    const newPosts = filterNewPosts(posts);
    console.log(`[フィルタ] 新規投稿: ${newPosts.length}件`);

    if (newPosts.length > 0) {
      await sendLineNotification(
        newPosts,
        process.env.LINE_CHANNEL_ACCESS_TOKEN,
        process.env.LINE_USER_ID
      );
      console.log(`[完了] ${newPosts.length}件をLINEに通知しました`);
    } else {
      console.log("[完了] 新しいバズ投稿はありませんでした");
    }
  } catch (err) {
    console.error("[エラー]", err.message);
  }
}

validateEnv();

console.log("=".repeat(50));
console.log("🔥 Trending Post Notifier 起動");
console.log(`   キーワード: ${CONFIG.keywords.map((k) => k.label).join(", ")}`);
console.log(`   閾値: ❤️ ${CONFIG.thresholds.min_likes}+ / 🔁 ${CONFIG.thresholds.min_retweets}+`);
console.log(`   スケジュール: ${CONFIG.schedule.description}`);
console.log("=".repeat(50));

// 起動時に1回実行
await run();

// スケジュール実行
cron.schedule(CONFIG.schedule.cron, run);
console.log(`\nスケジューラ起動中 (${CONFIG.schedule.cron})... Ctrl+C で停止`);
