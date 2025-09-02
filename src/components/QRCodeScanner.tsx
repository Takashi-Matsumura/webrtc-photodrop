'use client';

import { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import { FiCamera, FiUpload } from 'react-icons/fi';

interface QRCodeScannerProps {
  onScan: (data: string) => void;
  isScanning: boolean;
}

export function QRCodeScanner({ onScan, isScanning }: QRCodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qrScannerRef = useRef<QrScanner | null>(null);
  const [hasCamera, setHasCamera] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isScanning) return;

    const initCamera = async () => {
      try {
        const hasCamera = await QrScanner.hasCamera();
        setHasCamera(hasCamera);

        if (hasCamera && videoRef.current) {
          qrScannerRef.current = new QrScanner(
            videoRef.current,
            (result) => {
              onScan(result.data);
              qrScannerRef.current?.stop();
            },
            {
              highlightScanRegion: true,
              highlightCodeOutline: true,
            }
          );

          await qrScannerRef.current.start();
        }
      } catch (error) {
        console.error('Camera initialization failed:', error);
        setHasCamera(false);
      }
    };

    initCamera();

    return () => {
      if (qrScannerRef.current) {
        qrScannerRef.current.stop();
        qrScannerRef.current.destroy();
        qrScannerRef.current = null;
      }
    };
  }, [isScanning, onScan]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const result = await QrScanner.scanImage(file);
      onScan(result);
    } catch (error) {
      console.error('QR code scan failed:', error);
      alert('QRコードの読み取りに失敗しました');
    }
  };

  if (!isScanning) {
    return null;
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      {hasCamera === null && (
        <div className="flex items-center justify-center w-64 h-64 bg-gray-100 rounded-lg">
          <p className="text-gray-500">カメラを初期化中...</p>
        </div>
      )}

      {hasCamera && (
        <div className="relative">
          <video
            ref={videoRef}
            className="w-64 h-64 bg-black rounded-lg"
            playsInline
          />
          <div className="absolute inset-0 border-2 border-blue-500 rounded-lg pointer-events-none">
            <div className="absolute top-4 left-4 w-6 h-6 border-l-2 border-t-2 border-blue-500"></div>
            <div className="absolute top-4 right-4 w-6 h-6 border-r-2 border-t-2 border-blue-500"></div>
            <div className="absolute bottom-4 left-4 w-6 h-6 border-l-2 border-b-2 border-blue-500"></div>
            <div className="absolute bottom-4 right-4 w-6 h-6 border-r-2 border-b-2 border-blue-500"></div>
          </div>
        </div>
      )}

      <div className="flex flex-col items-center space-y-2">
        {hasCamera && (
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <FiCamera className="w-4 h-4" />
            <span>QRコードをカメラに向けてください</span>
          </div>
        )}

        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-500">または</span>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <FiUpload className="w-4 h-4" />
            <span>画像をアップロード</span>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>
    </div>
  );
}