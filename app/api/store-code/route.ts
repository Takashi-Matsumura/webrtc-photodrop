import { NextRequest, NextResponse } from 'next/server';
import { connectionStore, cleanupExpiredData, generateConnectionCode } from '../shared-storage';

export async function POST(req: NextRequest) {
  try {
    // 期限切れデータを削除
    cleanupExpiredData(connectionStore);

    const body = await req.json();
    const { data } = body;
    
    if (!data || typeof data !== 'string') {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    // 既存のコードで同じデータがあるかチェック
    for (const [code, entry] of connectionStore) {
      if (entry.data === data && entry.expiry > Date.now()) {
        console.log(`API: Existing code found for same data: ${code}`);
        return NextResponse.json({ 
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