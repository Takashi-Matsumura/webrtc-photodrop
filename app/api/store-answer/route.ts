import { NextRequest, NextResponse } from 'next/server';
import { storage } from '../storage/prisma-storage';

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
    
    
    // Answerを既存のコードに追加
    const success = await storage.setAnswer(upperCode, answer);
    
    if (success) {
      const stats = await storage.getStats();
      
      return NextResponse.json({
        message: 'Answer stored successfully',
        code: upperCode,
        answerLength: answer.length,
        totalCodes: stats.totalCodes
      });
    } else {
      const stats = await storage.getStats();
      
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