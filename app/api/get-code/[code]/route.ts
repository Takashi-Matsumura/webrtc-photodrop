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
    
    console.log(`API: Attempting to retrieve data for code: "${code}"`);
    console.log(`API: Total codes in store: ${connectionStore.size}`);
    console.log(`API: All stored codes:`, Array.from(connectionStore.keys()));
    console.log(`API: Looking for code: "${upperCode}"`);

    const offer = connectionStore.getOffer(upperCode);
    
    if (offer) {
      console.log(`API: ✅ Offer retrieved for code: ${code} (data length: ${offer.length})`);
      
      // Offer取得時は削除しない（Answerが追加される必要があるため）
      return NextResponse.json({ 
        data: offer,
        message: 'Offer retrieved successfully',
        dataLength: offer.length,
        totalCodes: connectionStore.size
      });
    } else {
      console.log(`API: ❌ No connection data found for code: ${code}`);
      return NextResponse.json({ 
        error: 'Code not found',
        availableCodes: Array.from(connectionStore.keys()),
        totalCodes: connectionStore.size
      }, { status: 404 });
    }
    
  } catch (error) {
    console.error('API: Error retrieving connection code:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}