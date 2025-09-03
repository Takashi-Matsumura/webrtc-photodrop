import { NextApiRequest, NextApiResponse } from 'next';

// メモリ内ストレージ（store-code.tsと同じインスタンスを参照）
// 注意: Vercel Functionsでは関数間でのメモリ共有は保証されないため、
// 本番環境では外部ストレージ（Redis等）の使用を推奨
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

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 期限切れデータを削除
    cleanupExpiredData();

    const { code } = req.query;
    if (!code || typeof code !== 'string' || code.length !== 6) {
      return res.status(400).json({ error: 'Invalid code format' });
    }

    const upperCode = code.toUpperCase();
    
    console.log(`API: Attempting to retrieve data for code: "${code}"`);
    console.log(`API: Total codes in store: ${connectionStore.size}`);
    console.log(`API: All stored codes:`, Array.from(connectionStore.keys()));
    console.log(`API: Looking for code: "${upperCode}"`);

    const entry = connectionStore.get(upperCode);
    
    if (entry) {
      // 有効期限をチェック
      if (entry.expiry > Date.now()) {
        console.log(`API: ✅ Connection data retrieved for code: ${code} (data length: ${entry.data.length})`);
        
        // 使用後は削除（セキュリティのため）
        connectionStore.delete(upperCode);
        console.log(`API: Code ${code} deleted from store. Remaining codes:`, Array.from(connectionStore.keys()));
        
        return res.json({ 
          data: entry.data,
          message: 'Data retrieved successfully',
          remainingCodes: connectionStore.size
        });
      } else {
        console.log(`API: ❌ Code ${code} has expired`);
        connectionStore.delete(upperCode);
        return res.status(410).json({ error: 'Code has expired' });
      }
    } else {
      console.log(`API: ❌ No connection data found for code: ${code}`);
      return res.status(404).json({ 
        error: 'Code not found',
        availableCodes: Array.from(connectionStore.keys()),
        totalCodes: connectionStore.size
      });
    }
    
  } catch (error) {
    console.error('API: Error retrieving connection code:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}