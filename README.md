# WebRTC Photo Drop

WebRTCを使用したP2P写真転送アプリです。スマートフォンからPCへ直接写真を送信できます。

## 特徴

- 📱 **P2P通信**: WebRTC DataChannelを使用した直接通信
- 🔗 **QRコード連携**: SDPの交換をQRコードで簡単に実行
- 📸 **写真転送**: スマホからPCへの画像ファイル転送
- 📊 **進捗表示**: 転送中の進捗をリアルタイムで表示
- 💻 **PWA対応**: スマートフォンにインストール可能
- 🔧 **環境変数対応**: STUN/TURNサーバーの設定をサポート

## 技術スタック

- **Next.js 15** (App Router)
- **TypeScript**
- **TailwindCSS**
- **React Icons**
- **WebRTC**
- **QRコード**: qrcode + qr-scanner

## 使用方法

### 1. 接続の確立

1. **PC側**: ブラウザで本アプリを開き、「PC（受信側）」を選択
2. **PC側**: 「接続を開始」ボタンをクリックしてQRコードを表示
3. **スマホ側**: 本アプリを開き、「スマートフォン（送信側）」を選択
4. **スマホ側**: PCのQRコードをスキャン
5. **スマホ側**: 接続用のQRコードが表示される
6. **PC側**: スマホのQRコードをスキャンして接続完了

### 2. 写真の送信

1. **スマホ側**: 「写真を選択」ボタンで画像を選択
2. **スマホ側**: 各写真の「送信」ボタンをクリック
3. **PC側**: 受信した写真をダウンロード可能

## 開発環境のセットアップ

### 前提条件

- Node.js 18以上
- npm または yarn

### インストール

```bash
git clone <repository-url>
cd webrtc-photo-drop
npm install
```

### 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3002](http://localhost:3002) を開いてください。

## 環境変数の設定

STUN/TURNサーバーを設定する場合は、`.env.local`ファイルを作成してください：

```env
# STUN サーバー（カンマ区切り）
NEXT_PUBLIC_WEBRTC_STUN_SERVERS=stun:stun1.l.google.com:19302,stun:stun2.l.google.com:19302

# TURN サーバー（カンマ区切り）
NEXT_PUBLIC_WEBRTC_TURN_SERVERS=turn:your-turn-server.com:3478
```

## PWA インストール

### スマートフォン

1. ブラウザでアプリを開く
2. ブラウザメニューから「ホーム画面に追加」を選択
3. インストール後、アプリアイコンからアクセス可能

### PC（Chrome）

1. アドレスバーの右側にある「インストール」アイコンをクリック
2. 「インストール」ボタンをクリック

## ファイル構造

```
webrtc-photo-drop/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── src/
│   ├── components/
│   │   ├── MobileSender.tsx      # スマホ側コンポーネント
│   │   ├── PCReceiver.tsx        # PC側コンポーネント
│   │   ├── QRCodeGenerator.tsx   # QRコード生成
│   │   └── QRCodeScanner.tsx     # QRコード読み取り
│   └── hooks/
│       └── useWebRTC.ts          # WebRTC管理フック
├── public/
│   ├── manifest.json             # PWA設定
│   ├── icon-192.png              # アプリアイコン
│   └── icon-512.png
└── package.json
```

## 主要機能

### WebRTC接続管理 (`useWebRTC`)

- **Offer/Answer方式**: PC側がOffer、スマホ側がAnswerを生成
- **ICE Candidate**: 自動的なNAT越え
- **Data Channel**: ファイル転送用の双方向チャネル

### ファイル転送

- **チャンク分割**: 大きなファイルを16KBずつに分割して送信
- **進捗追跡**: 送信/受信の進捗をリアルタイム表示
- **エラーハンドリング**: 転送失敗時の適切な処理

### QRコード連携

- **SDP交換**: WebRTCのSession Description Protocolを安全に交換
- **カメラスキャン**: スマホのカメラでリアルタイムスキャン
- **画像アップロード**: カメラが使用できない場合の代替手段

## トラブルシューティング

### 接続できない場合

1. **ファイアウォール**: ブラウザのWebRTC通信が許可されているか確認
2. **ネットワーク**: 同じネットワーク内での使用を推奨
3. **STUN/TURN**: 企業ネットワークの場合は適切なサーバー設定が必要

### カメラが起動しない場合

1. **HTTPS**: カメラアクセスにはHTTPS接続が必要（localhost除く）
2. **権限**: ブラウザのカメラアクセス許可を確認
3. **代替手段**: 「画像をアップロード」機能を使用

## ライセンス

MIT License
