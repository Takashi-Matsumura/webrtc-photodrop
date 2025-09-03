/**
 * WebRTC接続データを短縮コードに変換するユーティリティ
 * Prisma + Supabaseを使用してデバイス間でデータを共有
 */

/**
 * WebRTCデータを短縮コードで保存（API経由）
 */
export async function storeConnectionData(data: string): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('API calls not available on server side');
  }
  
  try {
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
    return result.code;
    
  } catch (error) {
    console.error('Failed to store connection code:', error);
    throw error;
  }
}

/**
 * 短縮コードからWebRTCデータを取得（API経由）
 */
export async function getConnectionData(code: string): Promise<string | null> {
  if (typeof window === 'undefined') {
    return null;
  }
  
  try {
    const upperCode = code.toUpperCase();
    const response = await fetch(`/api/get-code/${upperCode}`, {
      method: 'GET',
    });

    if (response.ok) {
      const result = await response.json();
      return result.data;
    } else {
      return null;
    }
    
  } catch (error) {
    console.error('Failed to retrieve connection code:', error);
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
    
    return response.ok;
    
  } catch (error) {
    console.error('Failed to validate connection code:', error);
    return false;
  }
}

/**
 * Answerをサーバーに保存
 */
export async function storeAnswer(code: string, answer: string): Promise<boolean> {
  if (typeof window === 'undefined') {
    throw new Error('API calls not available on server side');
  }
  
  try {
    const response = await fetch('/api/store-answer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code, answer }),
    });

    return response.ok;
    
  } catch (error) {
    console.error('Failed to store answer:', error);
    return false;
  }
}

/**
 * Answerをサーバーから取得
 */
export async function getAnswer(code: string): Promise<string | null> {
  if (typeof window === 'undefined') {
    return null;
  }
  
  try {
    const response = await fetch(`/api/get-answer/${code.toUpperCase()}`, {
      method: 'GET',
    });

    if (response.ok) {
      const result = await response.json();
      return result.data;
    } else {
      return null;
    }
    
  } catch (error) {
    console.error('Failed to retrieve answer:', error);
    return null;
  }
}

/**
 * ストアの統計情報を取得（デバッグ用）- API経由
 */
export async function getConnectionStoreStats(): Promise<{ totalCodes: number; codes: string[] }> {
  if (typeof window === 'undefined') {
    return { totalCodes: 0, codes: [] };
  }
  
  try {
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
    console.error('Failed to get store stats:', error);
    return { totalCodes: 0, codes: [] };
  }
}