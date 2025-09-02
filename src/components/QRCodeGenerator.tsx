'use client';

import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface QRCodeGeneratorProps {
  data: string;
  size?: number;
}

export function QRCodeGenerator({ data, size = 256 }: QRCodeGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && data) {
      console.log('Generating QR code with data length:', data.length);
      console.log('QR data preview:', data.substring(0, 200) + (data.length > 200 ? '...' : ''));
      
      // Canvas2Dの最適化
      canvasRef.current.getContext('2d', { willReadFrequently: true });
      
      QRCode.toCanvas(canvasRef.current, data, {
        width: size,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      }).then(() => {
        console.log('QR code generated successfully');
      }).catch((err) => {
        console.error('QR code generation failed:', err);
      });
    }
  }, [data, size]);

  if (!data) {
    return (
      <div className="flex items-center justify-center w-64 h-64 bg-gray-100 rounded-lg">
        <p className="text-gray-500">QRコード生成中...</p>
      </div>
    );
  }

  console.log('QRCodeGenerator rendering with data:', !!data, 'length:', data?.length);

  return (
    <div className="flex flex-col items-center space-y-4">
      <canvas ref={canvasRef} className="border border-gray-300 rounded-lg" />
      <p className="text-sm text-gray-600 text-center max-w-xs">
        このQRコードをスマートフォンでスキャンしてください
      </p>
      <div className="text-xs text-gray-400 max-w-xs break-all">
        Data: {data.substring(0, 100)}{data.length > 100 ? '...' : ''}
      </div>
    </div>
  );
}