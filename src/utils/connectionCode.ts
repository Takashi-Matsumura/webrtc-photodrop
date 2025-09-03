/**
 * WebRTC接続データを短縮コードに変換するユーティリティ
 * LocalStorageを使用してブラウザ間でデータを共有
 */

const STORAGE_KEY_PREFIX = 'webrtc-connection-';
const STORAGE_EXPIRY_KEY = 'webrtc-expiry-';

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
 * 期限切れのデータを削除
 */
function cleanupExpiredData() {
  if (typeof window === 'undefined') return; // サーバーサイドでは実行しない
  
  const now = Date.now();
  const keysToRemove: string[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_EXPIRY_KEY)) {
      const expiryTime = parseInt(localStorage.getItem(key) || '0');
      if (expiryTime < now) {
        const code = key.replace(STORAGE_EXPIRY_KEY, '');
        keysToRemove.push(code);
      }
    }
  }
  
  keysToRemove.forEach(code => {
    localStorage.removeItem(STORAGE_KEY_PREFIX + code);
    localStorage.removeItem(STORAGE_EXPIRY_KEY + code);
  });
}

/**
 * WebRTCデータを短縮コードで保存
 */
export function storeConnectionData(data: string): string {
  if (typeof window === 'undefined') {
    throw new Error('localStorage is not available on server side');
  }
  
  // 期限切れデータを削除
  cleanupExpiredData();
  
  // 既存のコードで同じデータがあるかチェック
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_KEY_PREFIX)) {
      const storedData = localStorage.getItem(key);
      if (storedData === data) {
        const code = key.replace(STORAGE_KEY_PREFIX, '');
        console.log(`Existing code found for same data: ${code}`);
        return code;
      }
    }
  }

  // 新しいコードを生成
  let code = generateConnectionCode();
  
  // 重複がないことを確認
  while (localStorage.getItem(STORAGE_KEY_PREFIX + code)) {
    code = generateConnectionCode();
  }

  // データと有効期限を保存
  const expiryTime = Date.now() + (24 * 60 * 60 * 1000); // 24時間後
  localStorage.setItem(STORAGE_KEY_PREFIX + code, data);
  localStorage.setItem(STORAGE_EXPIRY_KEY + code, expiryTime.toString());

  // デバッグ情報
  const totalCodes = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
    .filter(key => key?.startsWith(STORAGE_KEY_PREFIX)).length;
  
  console.log(`Connection data stored with code: ${code} (data length: ${data.length})`);
  console.log(`Total codes in localStorage: ${totalCodes}`);
  console.log(`All stored codes:`, getStoredCodes());
  return code;
}

/**
 * 現在保存されているすべてのコードを取得
 */
function getStoredCodes(): string[] {
  if (typeof window === 'undefined') return [];
  
  const codes: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_KEY_PREFIX)) {
      codes.push(key.replace(STORAGE_KEY_PREFIX, ''));
    }
  }
  return codes;
}

/**
 * 短縮コードからWebRTCデータを取得
 */
export function getConnectionData(code: string): string | null {
  if (typeof window === 'undefined') {
    console.log('❌ localStorage not available on server side');
    return null;
  }
  
  // 期限切れデータを削除
  cleanupExpiredData();
  
  const upperCode = code.toUpperCase();
  const storageKey = STORAGE_KEY_PREFIX + upperCode;
  const expiryKey = STORAGE_EXPIRY_KEY + upperCode;
  
  console.log(`Attempting to retrieve data for code: "${code}"`);
  console.log(`Total codes in localStorage:`, getStoredCodes().length);
  console.log(`All stored codes:`, getStoredCodes());
  console.log(`Looking for code: "${upperCode}"`);
  console.log(`Storage key: "${storageKey}"`);
  
  const data = localStorage.getItem(storageKey);
  const expiryTime = localStorage.getItem(expiryKey);
  
  console.log(`Code exists in localStorage:`, !!data);
  console.log(`Expiry time:`, expiryTime);
  
  if (data) {
    // 有効期限をチェック
    const expiry = parseInt(expiryTime || '0');
    if (expiry > Date.now()) {
      console.log(`✅ Connection data retrieved for code: ${code} (data length: ${data.length})`);
      
      // 使用後は削除（セキュリティのため）
      localStorage.removeItem(storageKey);
      localStorage.removeItem(expiryKey);
      console.log(`Code ${code} deleted from localStorage. Remaining codes:`, getStoredCodes());
      
      return data;
    } else {
      console.log(`❌ Code ${code} has expired`);
      localStorage.removeItem(storageKey);
      localStorage.removeItem(expiryKey);
    }
  } else {
    console.log(`❌ No connection data found for code: ${code}`);
  }
  
  return null;
}

/**
 * 有効なコードかどうかを確認
 */
export function isValidConnectionCode(code: string): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof code !== 'string' || code.length !== 6) {
    return false;
  }
  
  cleanupExpiredData();
  const storageKey = STORAGE_KEY_PREFIX + code.toUpperCase();
  const expiryKey = STORAGE_EXPIRY_KEY + code.toUpperCase();
  
  const data = localStorage.getItem(storageKey);
  const expiryTime = localStorage.getItem(expiryKey);
  
  if (!data || !expiryTime) return false;
  
  const expiry = parseInt(expiryTime);
  return expiry > Date.now();
}

/**
 * ストアの統計情報を取得（デバッグ用）
 */
export function getConnectionStoreStats() {
  if (typeof window === 'undefined') {
    return { totalCodes: 0, codes: [] };
  }
  
  cleanupExpiredData();
  const codes = getStoredCodes();
  
  return {
    totalCodes: codes.length,
    codes: codes,
  };
}