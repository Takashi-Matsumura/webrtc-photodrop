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
    
    const offer = await storage.getOffer(upperCode);
    
    if (offer) {
      
      return NextResponse.json({ 
        data: offer,
        message: 'Offer retrieved successfully',
        dataLength: offer.length
      });
    } else {
      const stats = await storage.getStats();
      
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