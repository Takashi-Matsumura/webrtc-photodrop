import { NextApiRequest, NextApiResponse } from 'next';

// メモリ内ストレージ（関数間で共有）
const connectionStore = new Map<string, { data: string; expiry: number }>();

// 期限切れのデータを削除
function cleanupExpiredData() {
  const now = Date.now();
  const keysToDelete: string[] = [];
  
  for (const [code, entry] of connectionStore) {
    if (entry.expiry < now) {
      keysToDelete.push(code);
    }
  }
  
  keysToDelete.forEach(code => connectionStore.delete(code));
}

// ランダムな6桁のコードを生成
function generateConnectionCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 期限切れデータを削除
    cleanupExpiredData();

    const { data } = req.body;
    if (!data || typeof data !== 'string') {
      return res.status(400).json({ error: 'Invalid data' });
    }

    // 既存のコードで同じデータがあるかチェック
    for (const [code, entry] of connectionStore) {
      if (entry.data === data && entry.expiry > Date.now()) {
        console.log(`API: Existing code found for same data: ${code}`);
        return res.json({ 
          code, 
          message: 'Code already exists for this data',
          totalCodes: connectionStore.size 
        });
      }
    }

    // 新しいコードを生成
    let code = generateConnectionCode();
    while (connectionStore.has(code)) {
      code = generateConnectionCode();
    }

    // データと有効期限を保存（24時間後）
    const expiryTime = Date.now() + (24 * 60 * 60 * 1000);
    connectionStore.set(code, { data, expiry: expiryTime });

    console.log(`API: Connection data stored with code: ${code} (data length: ${data.length})`);
    console.log(`API: Total codes in store: ${connectionStore.size}`);
    console.log(`API: All stored codes:`, Array.from(connectionStore.keys()));

    res.json({ 
      code, 
      message: 'Code generated successfully',
      totalCodes: connectionStore.size,
      dataLength: data.length
    });
    
  } catch (error) {
    console.error('API: Error storing connection code:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}