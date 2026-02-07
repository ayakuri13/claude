const PUSH_URL = "https://api.line.me/v2/bot/message/push";

function formatPost(post) {
  return [
    `📢 ${post.keyword_label}`,
    ``,
    `${post.text.slice(0, 200)}${post.text.length > 200 ? "..." : ""}`,
    ``,
    `❤️ ${post.likes}  🔁 ${post.retweets}  💬 ${post.replies}`,
    `👤 ${post.author}`,
    `🔗 ${post.url}`,
  ].join("\n");
}

function buildMessages(posts) {
  if (posts.length === 0) return [];

  const header = `🔥 バズ投稿が ${posts.length} 件見つかりました！\n${"─".repeat(20)}`;

  const chunks = [];
  let current = header;

  for (const post of posts) {
    const formatted = "\n\n" + formatPost(post);
    if (current.length + formatted.length > 4900) {
      chunks.push(current);
      current = `🔥 バズ投稿（続き）\n${"─".repeat(20)}` + formatted;
    } else {
      current += formatted;
    }
  }
  chunks.push(current);

  return chunks.map((text) => ({ type: "text", text }));
}

export async function sendLineNotification(posts, channelAccessToken, userId) {
  const messages = buildMessages(posts);

  if (messages.length === 0) {
    console.log("[LINE] 通知する投稿がありません");
    return;
  }

  // LINE API は1回のpushで最大5メッセージ
  const batches = [];
  for (let i = 0; i < messages.length; i += 5) {
    batches.push(messages.slice(i, i + 5));
  }

  for (const batch of batches) {
    const res = await fetch(PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        to: userId,
        messages: batch,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[LINE] 送信エラー: ${res.status} ${body}`);
    } else {
      console.log(`[LINE] ${batch.length}メッセージ送信完了`);
    }
  }
}
