# Trending Post Notifier

X（旧Twitter）のバズ投稿を自動検知してLINEに通知するツール。

自分の発信ジャンルに合わせたキーワードを設定し、いいね数やリツイート数が一定以上の投稿を見つけたらLINEにプッシュ通知します。

## 仕組み

```
キーワード設定 → X API で定期検索 → バズ判定 → LINE に通知
  (config.json)      (30分ごと)      (100❤️/100🔁)    (自動プッシュ)
```

## 必要なもの

1. **X (Twitter) API** - Basic プラン ($100/月) の Bearer Token
2. **LINE Messaging API** - チャネルアクセストークンとユーザーID

## セットアップ

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. 環境変数の設定

```bash
cp .env.example .env
```

`.env` を編集して、各APIキーを設定してください。

#### X API Bearer Token の取得方法
1. [X Developer Portal](https://developer.x.com/en/portal/dashboard) にアクセス
2. Basic プランに申し込む
3. App を作成し、Bearer Token を取得

#### LINE Messaging API の設定
1. [LINE Developers](https://developers.line.biz/console/) にログイン
2. 新しいプロバイダーとチャネル（Messaging API）を作成
3. チャネルアクセストークンを発行
4. 自分のユーザーIDを確認（チャネル基本設定 → あなたのユーザーID）

### 3. キーワードの設定

`config.json` を編集して、自分の発信ジャンルに合ったキーワードを設定します。

```json
{
  "keywords": [
    {
      "query": "AI 副業",
      "label": "AI副業"
    },
    {
      "query": "ChatGPT 活用",
      "label": "ChatGPT活用"
    }
  ],
  "thresholds": {
    "min_likes": 100,
    "min_retweets": 100
  }
}
```

- `query`: X の検索クエリ（スペース区切りでAND検索）
- `label`: LINE通知に表示されるラベル
- `min_likes` / `min_retweets`: どちらか一方を超えたら「バズ」と判定

### 4. 実行

```bash
# 常駐モード（30分ごとに自動検索）
npm start

# 1回だけ検索して通知
npm run search-once
```

## LINE通知のイメージ

```
🔥 バズ投稿が 3 件見つかりました！
────────────────────

📢 AI副業
AIを使った副業で月10万円を達成した方法を公開します...

❤️ 523  🔁 234  💬 45
👤 太郎 (@taro_ai)
🔗 https://x.com/taro_ai/status/123456789

📢 ChatGPT活用
ChatGPTのプロンプトでこれを知らない人が多すぎる...

❤️ 1,203  🔁 892  💬 167
👤 花子 (@hanako_gpt)
🔗 https://x.com/hanako_gpt/status/987654321
```

## ファイル構成

```
├── config.json          # キーワード・閾値の設定
├── .env                 # APIキー（git管理外）
├── src/
│   ├── index.js         # メイン（スケジューラ）
│   ├── run-once.js      # 1回だけ実行
│   ├── twitter.js       # X API 検索
│   ├── line.js          # LINE 通知送信
│   └── store.js         # 重複通知防止
└── data/
    └── notified.json    # 通知済みツイートID（自動生成）
```

## カスタマイズ

### 検索頻度を変える
`config.json` の `schedule.cron` を変更:
- `*/15 * * * *` → 15分ごと
- `*/30 * * * *` → 30分ごと
- `0 * * * *` → 1時間ごと

### バズの基準を変える
`config.json` の `thresholds` を変更:
- ゆるめ: `min_likes: 50, min_retweets: 50`
- 厳しめ: `min_likes: 500, min_retweets: 500`

### 検索対象の言語を変える
`config.json` の `search.lang` を変更:
- `ja` → 日本語のみ
- `en` → 英語のみ
- `""` → すべての言語
