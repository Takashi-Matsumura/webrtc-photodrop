import { NextRequest, NextResponse } from 'next/server';
import { connectionStore, cleanupExpiredData, generateConnectionCode, type ConnectionData } from '../shared-storage';

export async function POST(req: NextRequest) {
  try {
    // 期限切れデータを削除
    cleanupExpiredData(connectionStore);

    const body = await req.json();
    const { data } = body;
    
    if (!data || typeof data !== 'string') {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    // 既存のコードで同じOfferがあるかチェック
    for (const [code, entry] of connectionStore) {
      if (entry.offer === data && entry.expiry > Date.now()) {
        console.log(`API: Existing code found for same offer: ${code}`);
        return NextResponse.json({ 
          code, 
          message: 'Code already exists for this offer',
          totalCodes: connectionStore.size 
        });
      }
    }

    // 新しいコードを生成
    let code = generateConnectionCode();
    while (connectionStore.has(code)) {
      code = generateConnectionCode();
    }

    // Offerと有効期限を保存（24時間後）
    const now = Date.now();
    const expiryTime = now + (24 * 60 * 60 * 1000);
    const connectionData: ConnectionData = {
      offer: data,
      expiry: expiryTime,
      createdAt: now
    };
    connectionStore.set(code, connectionData);

    console.log(`API: Connection data stored with code: ${code} (data length: ${data.length})`);
    console.log(`API: Total codes in store: ${connectionStore.size}`);
    console.log(`API: All stored codes:`, Array.from(connectionStore.keys()));

    return NextResponse.json({ 
      code, 
      message: 'Code generated successfully',
      totalCodes: connectionStore.size,
      dataLength: data.length
    });
    
  } catch (error) {
    console.error('API: Error storing connection code:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}