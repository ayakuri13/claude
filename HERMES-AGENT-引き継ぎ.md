# Hermes Agent セットアップ 引き継ぎシート

> 帰宅後、自分のPCのターミナルで上から順にやればOK。スマホ・クラウド環境では完了できない（手順BのOAuthにブラウザが要るため）。
>
> Hermes Agent = Nous Research の CLI コーディングエージェント。**xAI Grok を API キーなし**で、SuperGrok / X Premium+ サブスク経由（OAuthログイン）で使えるのが特徴。

---

> ※あなたの環境は **macOS**。以下は Mac 前提で書いてある（Windowsの人は末尾の付録を参照）。

## 事前確認

- [ ] SuperGrok もしくは X Premium+ のサブスクに加入済み（OAuthログインで使う）
- [ ] ターミナル（標準の「ターミナル.app」でOK）が開ける

---

## 手順A：インストール（1回だけ・Mac）

ターミナルに貼って実行:

```bash
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
```

インストーラが uv / Python 3.11 / Node.js / ripgrep / ffmpeg などを自動で入れる（管理者権限・Homebrew は不要。すでに入っていればそれを使う）。

- [ ] 完了後、シェルを再読み込み（Macの標準シェルは zsh）:
  ```bash
  source ~/.zshrc
  ```
  （うまくいかなければターミナルを一度閉じて開き直す）
- [ ] 動作確認:
  ```bash
  hermes --version
  ```

---

## 手順B：xAI Grok を OAuth で接続

- [ ] プロバイダ／モデル選択を起動:
  ```bash
  hermes model
  ```
- [ ] リストから **「xAI Grok OAuth (SuperGrok / X Premium+)」** を選択
- [ ] ブラウザが `accounts.x.ai` を開く → **ログインして認可（Approve）**
- [ ] モデルを選ぶ → **`grok-4.3`（リスト先頭・推奨）**
- [ ] そのままチャットを開始して動けばOK

> API キー（XAI_API_KEY）は不要。一度ログインすれば、Hermes がバックグラウンドでセッションを自動更新する。
> 同じトークンは TTS / 画像生成 / 動画生成 / 文字起こし にも再利用される（1回のログインで全部カバー）。

---

## 手順C：うまくいかない時（既知の注意点）

**症状: ブラウザ認証は成功するのに、推論実行で `HTTP 403` が返る**

xAI 側が OAuth API 面に独自の許可リストを敷いており、**通常の SuperGrok 契約者が 403 で弾かれる**ケースが報告されている。その場合は **API キー方式に切り替える**:

- [ ] xAI から API キーを発行（https://x.ai/ → コンソール）
- [ ] 環境変数を設定:
  ```bash
  export XAI_API_KEY=xai-xxxxxxxxxxxxxxxx
  ```
- [ ] プロバイダを API キー方式へ:
  ```bash
  hermes setup          # ガイド付きで provider を xai に
  # もしくは単発で:
  hermes --provider xai
  ```

その他:
- `hermes` コマンドが見つからない → シェル再読み込み or ターミナル開き直し（手順A末尾）
- 設定をやり直したい → `hermes setup` で対話的に再構成

---

## メモ：このリポジトリ（Trending Post Notifier / 恋愛note運用ツール）との関係

- このリポジトリの `src/grok.js` は **xAI API キー方式（従量課金, 約 $0.1/回）** で Grok を呼んでいる。`npm run article` 等もこれを使う。
- **Hermes Agent は別物**（汎用の対話エージェント CLI）。SuperGrok サブスクで Grok を「会話・コーディング相棒」として使うためのもので、このリポジトリのスクリプトを直接置き換えるわけではない。
- もし狙いが「**API課金を避けて SuperGrok 契約だけで回したい**」なら、別途このリポジトリ側を OAuth トークン利用に寄せる改修が要る。その場合は遠慮なく相談を（このシートに追記する）。

---

## 付録：Windowsの場合（参考）

PowerShell で:
```powershell
iex (irm https://hermes-agent.nousresearch.com/install.ps1)
```
インストール後はターミナルを開き直してから手順Bへ。

---

## 出典（2026年6月時点）

- [xAI Grok OAuth (SuperGrok / X Premium+) | Hermes Agent 公式ガイド](https://hermes-agent.nousresearch.com/docs/guides/xai-grok-oauth)
- [NousResearch/hermes-agent (GitHub)](https://github.com/NousResearch/hermes-agent)
- [How to Use SuperGrok With Hermes Agent Without an xAI API Key — Hongkiat](https://www.hongkiat.com/blog/hermes-agent-xai-grok-oauth/)
