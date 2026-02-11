---
name: x-trend-research
description: Grok (xAI API + x_search) を使ってXのトレンド/バズ投稿を検索し、投稿ネタ出し・周辺リサーチを行う。
---

# X Trend Research Skill

## Overview

Claude Code 単体では X(Twitter) のリアルタイム検索が苦手。このスキルは Grok (xAI API) を「X検索専用レイヤー」として呼び出すことで、Xのバズ投稿やトレンドを正確に取得する。

## Available Commands

### 1. バズ投稿の検索 + LINE通知

設定したキーワードでXのバズ投稿を検索し、LINE（設定済みの場合）に通知する。

```bash
# 1回だけ検索
node src/run-once.js

# 常駐モード（30分ごとに自動検索）
npm start
```

### 2. 投稿ネタ出し（Ideation）

Xのタイムラインから「空気」を読み、投稿ネタを抽出する。

```bash
# デフォルト（AI / Web3、直近24時間）
node scripts/ideation.js --topic "AI / Web3"

# カスタム
node scripts/ideation.js --topic "Claude Code" --count 10 --hours 48 --audience engineer
```

出力: `data/ideation/` に Markdown + JSON で保存。

### 3. 周辺リサーチ（Context Research）

記事を書く前の「地ならし」として、一次情報・用語・反論・数字を揃えた Context Pack を作る。

```bash
node scripts/context_research.js --topic "ClaudeにX検索を足してリサーチを自動化する"
node scripts/context_research.js --topic "AI agent trends" --locale global --audience both
```

出力: `data/context-research/` に Markdown + JSON + TXT で保存。

## When To Use

- X のバズ投稿やトレンドを把握したいとき
- ブログ記事・X投稿の「ネタ出し」をしたいとき
- 記事執筆前に周辺情報を厚くしたいとき
- Claude Code だけでは X の最新情報が取れないとき

## Workflow

1. ユーザーが「Xのトレンドを調べて」「投稿ネタを出して」等と指示
2. このスキルが Grok (xAI API) を x_search ツール付きで呼び出す
3. Grok が X をリアルタイム検索し、結果を構造化して返す
4. 結果をファイルに保存 + LINE通知（設定されていれば）

## Requirements

- `XAI_API_KEY` が `.env` に設定されていること
- LINE通知を使う場合は `LINE_CHANNEL_ACCESS_TOKEN` と `LINE_USER_ID` も必要

## Configuration

キーワードや閾値は `config.json` で管理:

```json
{
  "keywords": [
    { "query": "AI 副業", "label": "AI副業" }
  ],
  "thresholds": {
    "min_likes": 100,
    "min_retweets": 100
  }
}
```
