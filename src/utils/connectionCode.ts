/**
 * WebRTC接続データを短縮コードに変換するユーティリティ
 */

// 一時的にデータを保存するためのマップ（実際のアプリではRedis等を使用）
const connectionDataStore = new Map<string, string>();

/**
 * ランダムな6桁のコードを生成
 */
function generateConnectionCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * WebRTCデータを短縮コードで保存
 */
export function storeConnectionData(data: string): string {
  // 既存のコードで同じデータがあるかチェック
  for (const [code, storedData] of connectionDataStore.entries()) {
    if (storedData === data) {
      return code;
    }
  }

  // 新しいコードを生成
  let code = generateConnectionCode();
  
  // 重複がないことを確認
  while (connectionDataStore.has(code)) {
    code = generateConnectionCode();
  }

  // データを保存（24時間後に自動削除）
  connectionDataStore.set(code, data);
  setTimeout(() => {
    connectionDataStore.delete(code);
  }, 24 * 60 * 60 * 1000); // 24時間

  console.log(`Connection data stored with code: ${code} (data length: ${data.length})`);
  return code;
}

/**
 * 短縮コードからWebRTCデータを取得
 */
export function getConnectionData(code: string): string | null {
  const data = connectionDataStore.get(code.toUpperCase());
  if (data) {
    console.log(`Connection data retrieved for code: ${code} (data length: ${data.length})`);
    // 使用後は削除（セキュリティのため）
    connectionDataStore.delete(code.toUpperCase());
  } else {
    console.log(`No connection data found for code: ${code}`);
  }
  return data || null;
}

/**
 * 有効なコードかどうかを確認
 */
export function isValidConnectionCode(code: string): boolean {
  if (typeof code !== 'string' || code.length !== 6) {
    return false;
  }
  return connectionDataStore.has(code.toUpperCase());
}

/**
 * ストアの統計情報を取得（デバッグ用）
 */
export function getConnectionStoreStats() {
  return {
    totalCodes: connectionDataStore.size,
    codes: Array.from(connectionDataStore.keys()),
  };
}