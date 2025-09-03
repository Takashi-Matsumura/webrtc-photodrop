import { NextRequest, NextResponse } from 'next/server';
import { connectionStore, cleanupExpiredData } from '../shared-storage';

export async function POST(req: NextRequest) {
  try {
    // 期限切れデータを削除
    cleanupExpiredData(connectionStore);

    const body = await req.json();
    const { code, answer } = body;
    
    if (!code || typeof code !== 'string' || code.length !== 6) {
      return NextResponse.json({ error: 'Invalid code format' }, { status: 400 });
    }
    
    if (!answer || typeof answer !== 'string') {
      return NextResponse.json({ error: 'Invalid answer data' }, { status: 400 });
    }

    const upperCode = code.toUpperCase();
    
    console.log(`API: Attempting to store answer for code: "${code}"`);
    console.log(`API: Answer data length: ${answer.length}`);
    
    // Answerを既存のコードに追加
    const success = connectionStore.setAnswer(upperCode, answer);
    
    if (success) {
      console.log(`API: ✅ Answer stored successfully for code: ${code}`);
      console.log(`API: Total codes in store: ${connectionStore.size}`);
      
      return NextResponse.json({
        message: 'Answer stored successfully',
        code: upperCode,
        answerLength: answer.length,
        totalCodes: connectionStore.size
      });
    } else {
      console.log(`API: ❌ Failed to store answer - code not found or expired: ${code}`);
      return NextResponse.json({ 
        error: 'Code not found or expired',
        availableCodes: Array.from(connectionStore.keys()),
        totalCodes: connectionStore.size
      }, { status: 404 });
    }
    
  } catch (error) {
    console.error('API: Error storing answer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}