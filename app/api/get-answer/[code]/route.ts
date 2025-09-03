import { NextRequest, NextResponse } from 'next/server';
import { connectionStore, cleanupExpiredData } from '../../shared-storage';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    // 期限切れデータを削除
    cleanupExpiredData(connectionStore);

    const { code } = await params;
    if (!code || typeof code !== 'string' || code.length !== 6) {
      return NextResponse.json({ error: 'Invalid code format' }, { status: 400 });
    }

    const upperCode = code.toUpperCase();
    
    console.log(`API: Attempting to retrieve answer for code: "${code}"`);
    console.log(`API: Total codes in store: ${connectionStore.size}`);
    console.log(`API: All stored codes:`, Array.from(connectionStore.keys()));

    const answer = connectionStore.getAnswer(upperCode);
    
    if (answer) {
      console.log(`API: ✅ Answer retrieved for code: ${code} (data length: ${answer.length})`);
      
      return NextResponse.json({ 
        data: answer,
        message: 'Answer retrieved successfully',
        dataLength: answer.length
      });
    } else {
      // Answerがまだない場合（まだスマホが接続中）
      const hasOffer = connectionStore.getOffer(upperCode);
      if (hasOffer) {
        console.log(`API: ⏳ Answer not ready yet for code: ${code}`);
        return NextResponse.json({ 
          error: 'Answer not ready',
          message: 'Waiting for mobile device to connect',
          hasOffer: true
        }, { status: 202 }); // 202 Accepted (処理中)
      } else {
        console.log(`API: ❌ Code not found: ${code}`);
        return NextResponse.json({ 
          error: 'Code not found',
          availableCodes: Array.from(connectionStore.keys()),
          totalCodes: connectionStore.size
        }, { status: 404 });
      }
    }
    
  } catch (error) {
    console.error('API: Error retrieving answer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}