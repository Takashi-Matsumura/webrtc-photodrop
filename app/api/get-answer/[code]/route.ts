import { NextRequest, NextResponse } from 'next/server';
import { kvStorage } from '../../storage/vercel-kv';

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
    
    console.log(`API: Attempting to retrieve answer for code: "${code}"`);

    const answer = await kvStorage.getAnswer(upperCode);
    
    if (answer) {
      console.log(`API: ✅ Answer retrieved for code: ${code} (data length: ${answer.length})`);
      
      // 使用後は削除（セキュリティのため）
      await kvStorage.delete(upperCode);
      console.log(`API: Code ${code} deleted from KV store`);
      
      return NextResponse.json({ 
        data: answer,
        message: 'Answer retrieved successfully',
        dataLength: answer.length
      });
    } else {
      // Answerがまだない場合（まだスマホが接続中）
      const hasOffer = await kvStorage.getOffer(upperCode);
      if (hasOffer) {
        console.log(`API: ⏳ Answer not ready yet for code: ${code}`);
        return NextResponse.json({ 
          error: 'Answer not ready',
          message: 'Waiting for mobile device to connect',
          hasOffer: true
        }, { status: 202 }); // 202 Accepted (処理中)
      } else {
        console.log(`API: ❌ Code not found: ${code}`);
        const stats = await kvStorage.getStats();
        
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