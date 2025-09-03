import { NextRequest, NextResponse } from 'next/server';
import { kvStorage } from '../storage/vercel-kv';

export async function POST(req: NextRequest) {
  try {
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
    const success = await kvStorage.setAnswer(upperCode, answer);
    
    if (success) {
      console.log(`API: ✅ Answer stored successfully for code: ${code}`);
      const stats = await kvStorage.getStats();
      
      return NextResponse.json({
        message: 'Answer stored successfully',
        code: upperCode,
        answerLength: answer.length,
        totalCodes: stats.totalCodes
      });
    } else {
      console.log(`API: ❌ Failed to store answer - code not found or expired: ${code}`);
      const stats = await kvStorage.getStats();
      
      return NextResponse.json({ 
        error: 'Code not found or expired',
        availableCodes: stats.codes,
        totalCodes: stats.totalCodes
      }, { status: 404 });
    }
    
  } catch (error) {
    console.error('API: Error storing answer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}