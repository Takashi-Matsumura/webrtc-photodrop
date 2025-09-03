/**
 * WebRTC接続データを短縮コードに変換するユーティリティ
 * Vercel Functionsを使用してデバイス間でデータを共有
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
 * WebRTCデータを短縮コードで保存（API経由）
 */
export async function storeConnectionData(data: string): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('API calls not available on server side');
  }
  
  try {
    console.log(`Client: Storing connection data via API (data length: ${data.length})`);
    
    const response = await fetch('/api/store-code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    console.log(`Client: ✅ Code generated successfully: ${result.code}`);
    console.log(`Client: Total codes on server: ${result.totalCodes}`);
    console.log(`Client: Data length: ${result.dataLength}`);
    
    return result.code;
    
  } catch (error) {
    console.error('Client: Error storing connection code:', error);
    throw error;
  }
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
 * 短縮コードからWebRTCデータを取得（API経由）
 */
export async function getConnectionData(code: string): Promise<string | null> {
  if (typeof window === 'undefined') {
    console.log('❌ API calls not available on server side');
    return null;
  }
  
  try {
    const upperCode = code.toUpperCase();
    console.log(`Client: Attempting to retrieve data for code: "${code}"`);
    
    const response = await fetch(`/api/get-code/${upperCode}`, {
      method: 'GET',
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`Client: ✅ Connection data retrieved for code: ${code} (data length: ${result.data.length})`);
      console.log(`Client: Remaining codes on server: ${result.remainingCodes}`);
      return result.data;
    } else if (response.status === 404) {
      const errorResult = await response.json();
      console.log(`Client: ❌ No connection data found for code: ${code}`);
      console.log(`Client: Available codes on server:`, errorResult.availableCodes);
      console.log(`Client: Total codes on server:`, errorResult.totalCodes);
      return null;
    } else if (response.status === 410) {
      console.log(`Client: ❌ Code ${code} has expired`);
      return null;
    } else {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
  } catch (error) {
    console.error('Client: Error retrieving connection code:', error);
    return null;
  }
}

/**
 * 有効なコードかどうかを確認（API経由）
 */
export async function isValidConnectionCode(code: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (typeof code !== 'string' || code.length !== 6) {
    return false;
  }
  
  try {
    const upperCode = code.toUpperCase();
    const response = await fetch(`/api/get-code/${upperCode}`, {
      method: 'GET',
    });
    
    // コードが存在し、期限切れでなければtrue
    return response.ok;
    
  } catch (error) {
    console.error('Client: Error validating connection code:', error);
    return false;
  }
}

/**
 * Answerをサーバーに保存（fallback付き）
 */
export async function storeAnswer(code: string, answer: string): Promise<boolean> {
  if (typeof window === 'undefined') {
    throw new Error('API calls not available on server side');
  }
  
  try {
    console.log(`Client: Storing answer for code: ${code} (data length: ${answer.length})`);
    
    const response = await fetch('/api/store-answer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code, answer }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`Client: ✅ Answer stored successfully for code: ${code} (server)`);
      console.log(`Client: Total codes on server: ${result.totalCodes}`);
      return true;
    } else {
      const errorResult = await response.json();
      console.error(`Client: ❌ Server storage failed: ${errorResult.error}`);
      
      // Fallback: localStorage保存
      console.log(`Client: 🔄 Falling back to localStorage for answer storage`);
      const answerKey = `webrtc-answer-${code.toUpperCase()}`;
      const expiryKey = `webrtc-answer-expiry-${code.toUpperCase()}`;
      const expiryTime = Date.now() + (24 * 60 * 60 * 1000);
      
      localStorage.setItem(answerKey, answer);
      localStorage.setItem(expiryKey, expiryTime.toString());
      
      console.log(`Client: ✅ Answer stored successfully for code: ${code} (localStorage fallback)`);
      return true;
    }
    
  } catch (error) {
    console.error('Client: Error storing answer:', error);
    
    // Fallback: localStorage保存
    console.log(`Client: 🔄 Network error, falling back to localStorage for answer storage`);
    const answerKey = `webrtc-answer-${code.toUpperCase()}`;
    const expiryKey = `webrtc-answer-expiry-${code.toUpperCase()}`;
    const expiryTime = Date.now() + (24 * 60 * 60 * 1000);
    
    localStorage.setItem(answerKey, answer);
    localStorage.setItem(expiryKey, expiryTime.toString());
    
    console.log(`Client: ✅ Answer stored successfully for code: ${code} (localStorage fallback)`);
    return true;
  }
}

/**
 * Answerをサーバーから取得（fallback付き）
 */
export async function getAnswer(code: string): Promise<string | null> {
  if (typeof window === 'undefined') {
    console.log('❌ API calls not available on server side');
    return null;
  }
  
  try {
    console.log(`Client: Attempting to retrieve answer for code: "${code}"`);
    
    const response = await fetch(`/api/get-answer/${code.toUpperCase()}`, {
      method: 'GET',
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`Client: ✅ Answer retrieved for code: ${code} (server) (data length: ${result.data?.length || 0})`);
      return result.data;
    } else if (response.status === 202) {
      // Answerがまだ準備できていない - localStorageもチェック
      console.log(`Client: ⏳ Answer not ready on server, checking localStorage for code: ${code}`);
      return checkLocalStorageForAnswer(code);
    } else {
      // サーバーで見つからない - localStorageをチェック
      console.log(`Client: ❌ Server failed, checking localStorage for answer: ${code}`);
      return checkLocalStorageForAnswer(code);
    }
    
  } catch (error) {
    console.error('Client: Network error retrieving answer, checking localStorage:', error);
    return checkLocalStorageForAnswer(code);
  }
}

/**
 * localStorageからAnswerを取得
 */
function checkLocalStorageForAnswer(code: string): string | null {
  const answerKey = `webrtc-answer-${code.toUpperCase()}`;
  const expiryKey = `webrtc-answer-expiry-${code.toUpperCase()}`;
  
  const answer = localStorage.getItem(answerKey);
  const expiryTime = localStorage.getItem(expiryKey);
  
  if (answer && expiryTime) {
    const expiry = parseInt(expiryTime);
    if (expiry > Date.now()) {
      console.log(`Client: ✅ Answer retrieved for code: ${code} (localStorage) (data length: ${answer.length})`);
      
      // 使用後は削除（セキュリティのため）
      localStorage.removeItem(answerKey);
      localStorage.removeItem(expiryKey);
      
      return answer;
    } else {
      console.log(`Client: ❌ Answer expired in localStorage for code: ${code}`);
      localStorage.removeItem(answerKey);
      localStorage.removeItem(expiryKey);
    }
  } else {
    console.log(`Client: ⏳ Answer not found in localStorage for code: ${code}`);
  }
  
  return null;
}

/**
 * ストアの統計情報を取得（デバッグ用）- API経由
 */
export async function getConnectionStoreStats(): Promise<{ totalCodes: number; codes: string[] }> {
  if (typeof window === 'undefined') {
    return { totalCodes: 0, codes: [] };
  }
  
  try {
    // APIから統計を取得するため、ダミーコードでリクエストを送信してエラーレスポンスから情報を取得
    const response = await fetch('/api/get-code/DUMMY000', {
      method: 'GET',
    });
    
    if (response.status === 404) {
      const result = await response.json();
      return {
        totalCodes: result.totalCodes || 0,
        codes: result.availableCodes || [],
      };
    }
    
    return { totalCodes: 0, codes: [] };
    
  } catch (error) {
    console.error('Client: Error getting store stats:', error);
    return { totalCodes: 0, codes: [] };
  }
}