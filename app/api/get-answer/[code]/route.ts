import { NextRequest, NextResponse } from 'next/server';
import { storage } from '../../storage/prisma-storage';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    if (!code || typeof code !== 'string' || code.length !== 6) {
      return NextResponse.json({ error: 'Invalid code format' }, { status: 400 });
    }

    const upperCode = code.toUpperCase();
    
    const answer = await storage.getAnswer(upperCode);
    
    if (answer) {
      // 使用後は削除（セキュリティのため）
      await storage.delete(upperCode);
      
      return NextResponse.json({ 
        data: answer,
        message: 'Answer retrieved successfully',
        dataLength: answer.length
      });
    } else {
      // Answerがまだない場合（まだスマホが接続中）
      const hasOffer = await storage.getOffer(upperCode);
      if (hasOffer) {
        return NextResponse.json({ 
          error: 'Answer not ready',
          message: 'Waiting for mobile device to connect',
          hasOffer: true
        }, { status: 202 }); // 202 Accepted (処理中)
      } else {
        const stats = await storage.getStats();
        
        return NextResponse.json({ 
          error: 'Code not found',
          availableCodes: stats.codes,
          totalCodes: stats.totalCodes
        }, { status: 404 });
      }
    }
    
  } catch (error) {
    console.error('API: Error retrieving answer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}