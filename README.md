# WebRTC Photo Drop

PCとスマートフォン間で写真を簡単に転送するWebアプリケーションです。WebRTC技術を使用してP2P通信により、サーバーを経由せず直接ファイルを転送できます。

## 主な機能

- **6桁コード接続**: PC側で生成される6桁のコードをスマートフォンで入力するだけで接続
- **リアルタイム転送**: WebRTCによる高速なP2P通信
- **複数ファイル対応**: 一度に複数の写真を選択・転送可能
- **プログレス表示**: 転送進捗をリアルタイムで表示
- **レスポンシブUI**: PC・モバイル両対応の使いやすいインターフェース

## 技術スタック

- **Frontend**: Next.js 15 (React 19)
- **Styling**: Tailwind CSS 4
- **Database**: Supabase PostgreSQL + Prisma ORM
- **Communication**: WebRTC (RTCPeerConnection, RTCDataChannel)
- **Deployment**: Vercel

## 使用方法

### 1. PC側（受信側）
1. ブラウザでアプリにアクセス
2. 「接続を開始」ボタンをクリック
3. 表示される6桁のコードをスマートフォンに伝える
4. 接続完了後、写真の受信を待機

### 2. スマートフォン側（送信側）
1. ブラウザでアプリにアクセス
2. PC側で表示された6桁コードを入力
3. 「接続」ボタンで接続を確立
4. 写真を選択して「写真を送信」

## セットアップ

### 前提条件
- Node.js 18以上
- npm または yarn
- Supabaseアカウント

### インストール

```bash
# リポジトリをクローン
git clone https://github.com/your-username/webrtc-photo-drop.git
cd webrtc-photo-drop

# 依存関係をインストール
npm install

# 環境変数を設定
cp .env.example .env.local
```

### データベース設定

1. [Supabase](https://supabase.com)でプロジェクトを作成
2. `.env.local`にDATABASE_URLを設定：
```bash
DATABASE_URL="postgresql://postgres.PROJECT_ID:PASSWORD@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"
```

3. データベーステーブルを作成：
```bash
npm run db:push
```

### 開発サーバー起動

```bash
npm run dev
```

http://localhost:3000 でアクセス可能

## デプロイ

### Vercelでのデプロイ

1. [Vercel](https://vercel.com)でプロジェクトをインポート
2. 環境変数 `DATABASE_URL` を設定
3. 自動デプロイ完了

## ファイル構造

```
webrtc-photo-drop/
├── app/
│   ├── api/                    # APIエンドポイント
│   │   ├── store-code/         # 接続コード保存
│   │   ├── get-code/           # 接続コード取得
│   │   ├── store-answer/       # Answer保存
│   │   └── get-answer/         # Answer取得
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── src/
│   ├── components/
│   │   ├── MobileSender.tsx    # モバイル側UI
│   │   └── PCReceiver.tsx      # PC側UI
│   ├── hooks/
│   │   └── useWebRTC.ts        # WebRTC管理フック
│   └── utils/
│       └── connectionCode.ts   # 接続コード管理
├── lib/
│   └── prisma.ts              # Prismaクライアント
├── prisma/
│   └── schema.prisma          # データベーススキーマ
└── package.json
```

## 環境変数

```bash
# 必須: Supabase PostgreSQL接続URL
DATABASE_URL="postgresql://..."

# オプション: STUN/TURNサーバー設定
WEBRTC_STUN_SERVERS="stun:stun1.l.google.com:19302"
WEBRTC_TURN_SERVERS="turn:your-turn-server.com:3478"
```

## ライセンス

MIT License

## 貢献

プルリクエストや課題報告を歓迎します。