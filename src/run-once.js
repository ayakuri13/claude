import "dotenv/config";
import { searchTrendingPosts } from "./twitter.js";
import { sendLineNotification } from "./line.js";
import { filterNewPosts } from "./store.js";

const required = ["X_BEARER_TOKEN", "LINE_CHANNEL_ACCESS_TOKEN", "LINE_USER_ID"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`必須の環境変数が未設定です: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("1回だけ検索を実行します...\n");

const posts = await searchTrendingPosts(process.env.X_BEARER_TOKEN);
console.log(`\nバズ投稿: ${posts.length}件`);

const newPosts = filterNewPosts(posts);
console.log(`新規投稿: ${newPosts.length}件\n`);

if (newPosts.length > 0) {
  await sendLineNotification(
    newPosts,
    process.env.LINE_CHANNEL_ACCESS_TOKEN,
    process.env.LINE_USER_ID
  );
  console.log(`${newPosts.length}件をLINEに通知しました`);
} else {
  console.log("新しいバズ投稿はありませんでした");
}
