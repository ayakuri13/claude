import "dotenv/config";
import { searchTrendingPosts } from "./trending.js";
import { sendLineNotification } from "./line.js";
import { filterNewPosts } from "./store.js";

if (!process.env.XAI_API_KEY) {
  console.error("XAI_API_KEY が未設定です。.env ファイルを確認してください。");
  process.exit(1);
}

console.log("1回だけ検索を実行します...\n");

const posts = await searchTrendingPosts();
console.log(`\nバズ投稿: ${posts.length}件`);

const newPosts = filterNewPosts(posts);
console.log(`新規投稿: ${newPosts.length}件\n`);

if (newPosts.length > 0) {
  for (const p of newPosts) {
    console.log(`📢 ${p.keyword_label} | ${p.author} | ❤️${p.likes ?? "?"} 🔁${p.retweets ?? "?"}`);
    console.log(`   ${p.text.slice(0, 100)}`);
    if (p.why_trending) console.log(`   💡 ${p.why_trending}`);
    console.log(`   🔗 ${p.url}\n`);
  }

  if (process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_USER_ID) {
    await sendLineNotification(
      newPosts,
      process.env.LINE_CHANNEL_ACCESS_TOKEN,
      process.env.LINE_USER_ID
    );
    console.log(`${newPosts.length}件をLINEに通知しました`);
  } else {
    console.log("（LINE未設定のためコンソール表示のみ）");
  }
} else {
  console.log("新しいバズ投稿はありませんでした");
}
