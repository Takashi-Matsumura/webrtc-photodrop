# Vercel デプロイガイド

## Vercelへのデプロイ手順

### 1. Vercel CLIのインストール

```bash
npm install -g vercel
```

### 2. プロジェクトのデプロイ

```bash
# プロジェクトルートで実行
vercel

# または、GitHubと連携してデプロイ
# https://vercel.com でGitHubリポジトリを接続
```

### 3. 環境変数の設定（オプション）

Vercelダッシュボードまたはコマンドラインで環境変数を設定できます：

#### コマンドラインでの設定
```bash
# STUN サーバーの設定
vercel env add NEXT_PUBLIC_WEBRTC_STUN_SERVERS

# 値の例: stun:stun1.l.google.com:19302,stun:stun2.l.google.com:19302

# TURN サーバーの設定（企業ネットワーク等で必要な場合）
vercel env add NEXT_PUBLIC_WEBRTC_TURN_SERVERS

# 値の例: turn:your-turn-server.com:3478
```

#### Vercelダッシュボードでの設定
1. Vercelダッシュボードでプロジェクトを選択
2. Settings → Environment Variables
3. 以下の環境変数を追加：

| キー | 値の例 | 必須 |
|-----|--------|------|
| `NEXT_PUBLIC_WEBRTC_STUN_SERVERS` | `stun:stun1.l.google.com:19302,stun:stun2.l.google.com:19302` | いいえ |
| `NEXT_PUBLIC_WEBRTC_TURN_SERVERS` | `turn:your-turn-server.com:3478` | いいえ |

### 4. HTTPSの確認

WebRTCやカメラアクセスにはHTTPS接続が必要です。Vercelは自動でHTTPSを提供するため、追加設定は不要です。

### 5. PWA機能の有効化

デプロイ後、以下の機能が自動で有効になります：
- マニフェストファイル（`/manifest.json`）
- Service Worker（必要に応じて追加実装）
- インストール可能なPWA

### 6. デバイス別テスト

#### PC側テスト
1. デプロイされたURLをPCブラウザで開く
2. 「PC（受信側）」を選択
3. カメラアクセス許可（QRコードスキャン用）

#### スマートフォン側テスト
1. 同じURLをスマートフォンで開く
2. 「スマートフォン（送信側）」を選択
3. カメラアクセス許可（QRコードスキャン用）
4. 写真アクセス許可（ファイル選択用）

### 7. トラブルシューティング

#### カメラが動作しない場合
- HTTPSアクセスであることを確認
- ブラウザの権限設定でカメラアクセスを許可
- プライベートブラウジングモードでは制限がある場合があります

#### WebRTC接続ができない場合
- 企業ネットワークの場合は、TURN サーバーの設定が必要
- ファイアウォールでWebRTC通信が制限されていないか確認

#### PWAインストールができない場合
- HTTPS接続であることを確認
- マニフェストファイルが正しく配信されていることを確認
- ブラウザのPWA対応状況を確認

## デプロイ後の確認項目

- [ ] HTTPSでアクセスできる
- [ ] PC側で「接続を開始」してQRコードが表示される
- [ ] スマホ側でQRコードスキャンができる
- [ ] スマホ側でQRコード生成される
- [ ] PC側でスマホのQRコードスキャンができる
- [ ] WebRTC接続が確立される
- [ ] スマホで写真選択ができる
- [ ] 写真転送が成功する
- [ ] PC側で写真ダウンロードができる
- [ ] PWAとしてインストールできる（スマートフォン）

## パフォーマンス最適化

Vercelでは以下の最適化が自動で行われます：
- 静的ファイルのCDN配信
- 画像の最適化
- コード分割による高速読み込み
- HTTP/2対応

## カスタムドメイン設定

Vercelダッシュボードから独自ドメインを設定できます：
1. Domains設定でドメインを追加
2. DNS設定でCNAMEレコードを追加
3. SSL証明書の自動発行

## 監視とログ

Vercelダッシュボードで以下を監視できます：
- デプロイ状況
- アクセス状況
- エラーログ
- パフォーマンス指標