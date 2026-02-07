import { readFileSync } from "fs";

const CONFIG = JSON.parse(readFileSync(new URL("../config.json", import.meta.url), "utf-8"));

const SEARCH_URL = "https://api.twitter.com/2/tweets/search/recent";

function buildQuery(keyword) {
  let q = keyword.query;
  if (CONFIG.search.lang) {
    q += ` lang:${CONFIG.search.lang}`;
  }
  if (CONFIG.search.exclude_retweets) {
    q += " -is:retweet";
  }
  return q;
}

function buildSinceDate(hoursAgo) {
  const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
  return since.toISOString();
}

export async function searchTrendingPosts(bearerToken) {
  const results = [];

  for (const keyword of CONFIG.keywords) {
    const query = buildQuery(keyword);
    const startTime = buildSinceDate(CONFIG.search.hours_ago);

    const params = new URLSearchParams({
      query,
      max_results: String(Math.min(CONFIG.search.max_results_per_query, 100)),
      start_time: startTime,
      "tweet.fields": "public_metrics,created_at,author_id",
      expansions: "author_id",
      "user.fields": "username,name",
    });

    const url = `${SEARCH_URL}?${params}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${bearerToken}` },
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[X API] "${keyword.label}" の検索でエラー: ${res.status} ${body}`);
      continue;
    }

    const json = await res.json();

    if (!json.data || json.data.length === 0) {
      console.log(`[X API] "${keyword.label}" の検索結果: 0件`);
      continue;
    }

    const usersMap = new Map();
    if (json.includes?.users) {
      for (const user of json.includes.users) {
        usersMap.set(user.id, user);
      }
    }

    const { min_likes, min_retweets } = CONFIG.thresholds;

    for (const tweet of json.data) {
      const metrics = tweet.public_metrics;
      const isTrending =
        metrics.like_count >= min_likes || metrics.retweet_count >= min_retweets;

      if (isTrending) {
        const user = usersMap.get(tweet.author_id);
        results.push({
          id: tweet.id,
          text: tweet.text,
          likes: metrics.like_count,
          retweets: metrics.retweet_count,
          replies: metrics.reply_count,
          created_at: tweet.created_at,
          author: user ? `${user.name} (@${user.username})` : "不明",
          username: user?.username || "unknown",
          keyword_label: keyword.label,
          url: `https://x.com/${user?.username || "i"}/status/${tweet.id}`,
        });
      }
    }

    console.log(
      `[X API] "${keyword.label}": ${json.data.length}件中 ${results.length}件がバズ投稿`
    );
  }

  results.sort((a, b) => b.likes + b.retweets - (a.likes + a.retweets));

  return results;
}
