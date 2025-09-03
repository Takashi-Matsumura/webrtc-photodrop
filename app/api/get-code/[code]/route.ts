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
    
    console.log(`API: Attempting to retrieve offer for code: "${code}"`);

    const offer = await kvStorage.getOffer(upperCode);
    
    if (offer) {
      console.log(`API: ✅ Offer retrieved for code: ${code} (data length: ${offer.length})`);
      
      return NextResponse.json({ 
        data: offer,
        message: 'Offer retrieved successfully',
        dataLength: offer.length
      });
    } else {
      console.log(`API: ❌ No offer found for code: ${code}`);
      const stats = await kvStorage.getStats();
      
      return NextResponse.json({ 
        error: 'Code not found',
        availableCodes: stats.codes,
        totalCodes: stats.totalCodes
      }, { status: 404 });
    }
    
  } catch (error) {
    console.error('API: Error retrieving offer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}