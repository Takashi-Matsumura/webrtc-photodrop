import { NextRequest, NextResponse } from 'next/server';
import { storage } from '../storage/prisma-storage';
import { generateConnectionCode } from '../shared-storage';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { data } = body;
    
    if (!data || typeof data !== 'string') {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    // 新しいコードを生成
    let code = generateConnectionCode();
    
    // 既存コードとの重複チェック（最大10回試行）
    let attempts = 0;
    while (attempts < 10) {
      const existing = await storage.get(code);
      if (!existing) break;
      code = generateConnectionCode();
      attempts++;
    }

    if (attempts >= 10) {
      return NextResponse.json({ error: 'Failed to generate unique code' }, { status: 500 });
    }

    // Offerと有効期限を保存
    const now = Date.now();
    const connectionData = {
      offer: data,
      expiry: now + (24 * 60 * 60 * 1000),
      createdAt: now
    };
    
    await storage.set(code, connectionData);

    console.log(`API: Connection data stored with code: ${code} (data length: ${data.length})`);
    
    const stats = await storage.getStats();
    console.log(`API: Total codes in store: ${stats.totalCodes}`);

    return NextResponse.json({ 
      code, 
      message: 'Code generated successfully',
      totalCodes: stats.totalCodes,
      dataLength: data.length
    });
    
  } catch (error) {
    console.error('API: Error storing connection code:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}