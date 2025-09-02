'use client';

import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface QRCodeGeneratorProps {
  data: string;
  size?: number;
  partNumber?: number;
  totalParts?: number;
  title?: string;
}

export function QRCodeGenerator({ data, size = 500, partNumber, totalParts, title }: QRCodeGeneratorProps) {
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
        errorCorrectionLevel: 'H', // 高いエラー修正レベル
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
      {/* タイトルまたは番号表示 */}
      {(title || (partNumber && totalParts)) && (
        <div className="text-center">
          {title && (
            <h3 className="text-lg font-semibold text-gray-800 mb-1">{title}</h3>
          )}
          {partNumber && totalParts && (
            <div className="text-2xl font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded-lg">
              QRコード {partNumber} / {totalParts}
            </div>
          )}
        </div>
      )}
      
      <div className="relative">
        <canvas ref={canvasRef} className="border-2 border-blue-300 rounded-lg shadow-lg max-w-full h-auto" />
        
        {/* 角に番号を表示 */}
        {partNumber && (
          <div className="absolute -top-3 -right-3 bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold shadow-lg">
            {partNumber}
          </div>
        )}
      </div>
      
      <p className="text-sm text-gray-600 text-center max-w-xs">
        {partNumber && totalParts 
          ? `このQRコード（${partNumber}/${totalParts}）をスマートフォンでスキャンしてください`
          : 'このQRコードをスマートフォンでスキャンしてください'
        }
      </p>
      
      {/* プログレスバー */}
      {partNumber && totalParts && (
        <div className="w-full max-w-xs">
          <div className="bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((partNumber - 1) / totalParts) * 100}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-500 text-center mt-1">
            進行状況: {partNumber - 1} / {totalParts} 完了
          </p>
        </div>
      )}
      
      <div className="text-xs text-gray-400 max-w-xs break-all">
        Data: {data.substring(0, 100)}{data.length > 100 ? '...' : ''}
      </div>
    </div>
  );
}