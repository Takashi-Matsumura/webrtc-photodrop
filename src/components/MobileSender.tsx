'use client';

import { useState, useRef } from 'react';
import { useWebRTC } from '@/hooks/useWebRTC';
import { QRCodeGenerator } from './QRCodeGenerator';
import { QRCodeScanner } from './QRCodeScanner';
import { FiWifi, FiWifiOff, FiImage, FiUpload, FiRefreshCw, FiMonitor } from 'react-icons/fi';

export function MobileSender() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [currentStep, setCurrentStep] = useState<'scan' | 'generate' | 'connected'>('scan');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    connectionState,
    localDescription,
    error,
    handleRemoteDescription,
    sendFile,
    disconnect
  } = useWebRTC({
    onProgress: setProgress
  });

  const handleScanOffer = async (offerData: string) => {
    await handleRemoteDescription(offerData);
    setIsScanning(false);
    setCurrentStep('generate');
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    setSelectedFiles(imageFiles);
  };

  const handleSendFile = async (file: File) => {
    if (connectionState === 'connected') {
      setProgress(0);
      await sendFile(file);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getStatusIcon = () => {
    switch (connectionState) {
      case 'connected':
        return <FiWifi className="w-5 h-5 text-green-500" />;
      case 'connecting':
        return <FiRefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <FiWifiOff className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusText = () => {
    switch (connectionState) {
      case 'connected':
        return 'PCと接続済み';
      case 'connecting':
        return '接続中...';
      case 'failed':
        return '接続に失敗しました';
      default:
        return '未接続';
    }
  };

  return (
    <div className="max-w-lg mx-auto p-4 space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">写真送信（スマホ）</h1>
        <div className="flex items-center justify-center space-x-2">
          {getStatusIcon()}
          <span className="text-sm text-gray-600">{getStatusText()}</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {currentStep === 'scan' && (
        <div className="text-center space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">
              PCで表示されたQRコードを読み取り
            </h3>
            <button
              onClick={() => setIsScanning(true)}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <FiMonitor className="w-4 h-4" />
              <span>PCのQRコードを読み取り</span>
            </button>
          </div>
        </div>
      )}

      {isScanning && (
        <div className="text-center">
          <h3 className="font-semibold text-gray-900 mb-4">
            PCで表示されたQRコードを読み取ってください
          </h3>
          <QRCodeScanner onScan={handleScanOffer} isScanning={isScanning} />
          <button
            onClick={() => setIsScanning(false)}
            className="mt-4 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            キャンセル
          </button>
        </div>
      )}

      {currentStep === 'generate' && localDescription && connectionState === 'connecting' && (
        <div className="text-center space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 mb-2">
              このQRコードをPCで読み取ってください
            </h3>
            <QRCodeGenerator data={localDescription} />
            <p className="text-sm text-green-800 mt-2">
              PCでこのQRコードを読み取ると接続が完了します
            </p>
          </div>
        </div>
      )}

      {connectionState === 'connected' && (
        <>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <FiWifi className="w-5 h-5 text-green-500" />
              <span className="font-semibold text-green-900">接続完了！</span>
            </div>
            <p className="text-green-800 text-sm">
              写真を選択して送信できます
            </p>
          </div>

          <div className="space-y-4">
            <div className="text-center">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors w-full sm:w-auto"
              >
                <FiImage className="w-5 h-5" />
                <span>写真を選択</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {progress > 0 && progress < 100 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">送信中...</h3>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-blue-800 mt-1">{Math.round(progress)}%</p>
              </div>
            )}

            {selectedFiles.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900">選択した写真</h3>
                <div className="grid grid-cols-2 gap-3">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="relative border border-gray-200 rounded-lg p-2">
                      <div className="aspect-square bg-gray-100 rounded-lg mb-2 overflow-hidden">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={file.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs text-gray-600 truncate">{file.name}</p>
                        <p className="text-xs text-gray-500">
                          {(file.size / 1024 / 1024).toFixed(1)} MB
                        </p>
                        <div className="flex space-x-1">
                          <button
                            onClick={() => handleSendFile(file)}
                            disabled={progress > 0 && progress < 100}
                            className="flex items-center justify-center space-x-1 px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-1"
                          >
                            <FiUpload className="w-3 h-3" />
                            <span>送信</span>
                          </button>
                          <button
                            onClick={() => removeFile(index)}
                            className="px-2 py-1 text-red-600 border border-red-300 text-xs rounded hover:bg-red-50 transition-colors"
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="text-center">
            <button
              onClick={disconnect}
              className="px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
            >
              接続を切断
            </button>
          </div>
        </>
      )}
    </div>
  );
}