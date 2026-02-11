# Trending Post Notifier

Grok（xAI API）をX検索専用レイヤーとして使い、バズ投稿を検知してLINEに通知するツール。

Claude Code や ChatGPT は X のリアルタイム検索が苦手。Grok は X 社製なので X 投稿の検索が強い。これを API 経由で呼び出し、バズ投稿の検出・投稿ネタ出し・周辺リサーチを自動化する。

## 仕組み

```
config.json でキーワード設定
        ↓
Grok (xAI API + x_search) で X をリアルタイム検索
        ↓
バズ判定（❤️100+ or 🔁100+）
        ↓
重複排除
        ↓
LINE にプッシュ通知（or コンソール出力）
```

## 3つの機能

| コマンド | 用途 | 出力 |
|---------|------|------|
| `npm start` | バズ投稿の定期検索 + LINE通知 | LINE / コンソール |
| `npm run ideation -- --topic "AI"` | X の空気を読んで投稿ネタ出し | `data/ideation/` |
| `npm run research -- --topic "..."` | 記事執筆前の周辺リサーチ | `data/context-research/` |

## セットアップ

### 1. xAI API キーの取得

1. [xAI 公式](https://x.ai/) にアクセスしてサインアップ
2. コンソールから API Key を発行
3. 課金設定を行う（従量課金、1回の呼び出し約 $0.1）

### 2. 依存パッケージのインストール

```bash
npm install
```

### 3. 環境変数の設定

```bash
cp .env.example .env
```

`.env` を編集:

```dotenv
XAI_API_KEY=xai-xxxxxxxxxxxxxxxxxx

# LINE通知を使う場合（任意）
LINE_CHANNEL_ACCESS_TOKEN=your_token
LINE_USER_ID=your_user_id
```

### 4. LINE Messaging API の設定（任意）

LINE通知が不要なら、この手順はスキップ可（コンソール出力のみになる）。

1. [LINE Developers](https://developers.line.biz/console/) にログイン
2. プロバイダー → チャネル（Messaging API）を作成
3. チャネルアクセストークンを発行
4. 自分のユーザーIDを確認

### 5. キーワードの設定

`config.json` を編集して、自分の発信ジャンルに合ったキーワードを設定:

```json
{
  "keywords": [
    { "query": "AI 副業", "label": "AI副業" },
    { "query": "Claude Code", "label": "Claude Code" }
  ],
  "thresholds": {
    "min_likes": 100,
    "min_retweets": 100
  }
}
```

## 使い方

### バズ投稿の検索 + LINE通知

```bash
# 常駐モード（30分ごとに自動検索）
npm start

# 1回だけ検索
npm run search-once
```

### 投稿ネタ出し（Ideation）

X のタイムラインから「空気」を読み、バズ投稿の素材を抽出する。

```bash
# 基本
npm run ideation -- --topic "AI / Web3"

# カスタム
npm run ideation -- --topic "Claude Code" --count 10 --hours 48 --audience engineer

# オプション一覧
npm run ideation -- --help
```

出力:
- タイムラインの空気（論点のクラスター）3-5個
- 今日の結論（狙うべき3テーマ）
- 素材一覧（URL・要約・エンゲージ指標・フック案付き）

### 周辺リサーチ（Context Research）

記事を書く前の「地ならし」。一次情報・用語・反論・数字を揃えた Context Pack を作る。

```bash
# 基本
npm run research -- --topic "GrokでX検索を自動化する"

# グローバル検索
npm run research -- --topic "AI agent trends" --locale global --audience both

# オプション一覧
npm run research -- --help
```

## LINE通知のイメージ

```
🔥 バズ投稿が 3 件見つかりました！
────────────────────

📢 AI副業
AIを使った副業で月10万円を達成した方法を公開します...

❤️ 523  🔁 234  💬 45
👤 太郎 (@taro_ai)
💡 具体的な金額と手順が明確で再現性を感じさせる
🔗 https://x.com/taro_ai/status/123456789
```

## Claude Code のスキルとして使う

`skills/x-trend-research/SKILL.md` を参照。Claude Code から呼び出すことで、X のトレンドリサーチを Claude の対話の中で実行できる。

## ファイル構成

```
├── config.json                       # キーワード・閾値・スケジュール
├── .env                              # APIキー（git管理外）
├── src/
│   ├── index.js                      # メイン（スケジューラ）
│   ├── run-once.js                   # 1回だけ実行
│   ├── grok.js                       # xAI (Grok) API クライアント
│   ├── trending.js                   # バズ投稿検索ロジック
│   ├── line.js                       # LINE 通知
│   └── store.js                      # 重複通知防止
├── scripts/
│   ├── ideation.js                   # 投稿ネタ出し
│   └── context_research.js           # 周辺リサーチ
├── skills/
│   └── x-trend-research/
│       ├── SKILL.md                  # Claude Code スキル定義
│       └── references/
│           └── context_pack_template.md
└── data/                             # 出力先（git管理外）
    ├── ideation/
    └── context-research/
```

## カスタマイズ

### 検索頻度を変える
`config.json` の `schedule.cron` を変更:
- `*/15 * * * *` → 15分ごと
- `*/30 * * * *` → 30分ごと（デフォルト）
- `0 * * * *` → 1時間ごと

### バズの基準を変える
`config.json` の `thresholds` を変更:
- ゆるめ: `min_likes: 50, min_retweets: 50`
- 厳しめ: `min_likes: 500, min_retweets: 500`

### Grok のモデルを変える
`.env` の `XAI_MODEL` を変更:
- `grok-3-fast` （デフォルト、高速）
- `grok-3` （より高品質）

## なぜ Grok なのか

| | Claude Code / ChatGPT | Grok (xAI API) |
|---|---|---|
| X の検索 | 苦手（情報源に触れる手段がない） | 強い（X社製、x_search ツール内蔵） |
| リアルタイム性 | 知識カットオフに依存 | リアルタイム |
| コスト | - | 従量課金（約 $0.1/回） |

Claude Code の「頭脳」+ Grok の「X検索能力」の組み合わせが最適。
