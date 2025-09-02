'use client';

import { useState } from 'react';
import { useWebRTC } from '@/hooks/useWebRTC';
import { QRCodeGenerator } from './QRCodeGenerator';
import { QRCodeScanner } from './QRCodeScanner';
import { FiWifi, FiWifiOff, FiDownload, FiRefreshCw, FiSmartphone } from 'react-icons/fi';

export function PCReceiver() {
  const [receivedFiles, setReceivedFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
  const [isScanning, setIsScanning] = useState(false);

  const {
    connectionState,
    localDescription,
    error,
    createOffer,
    handleRemoteDescription,
    disconnect
  } = useWebRTC({
    onFileReceived: (file) => {
      setReceivedFiles(prev => [...prev, file]);
      setProgress(0);
    },
    onProgress: setProgress
  });

  const handleStartConnection = async () => {
    console.log('Creating WebRTC offer...');
    await createOffer();
    console.log('Offer created, localDescription available:', !!localDescription);
  };

  const handleScanAnswer = (answerData: string) => {
    console.log('Answer QR scanned:', answerData.substring(0, 100) + '...');
    handleRemoteDescription(answerData);
    setIsScanning(false);
  };

  const downloadFile = (file: File) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
        return 'スマホと接続済み';
      case 'connecting':
        return '接続中...';
      case 'failed':
        return '接続に失敗しました';
      default:
        return '未接続';
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">写真受信（PC）</h1>
        <div className="flex items-center justify-center space-x-2">
          {getStatusIcon()}
          <span className="text-sm text-gray-600">{getStatusText()}</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {connectionState === 'disconnected' && (
        <div className="text-center">
          <button
            onClick={handleStartConnection}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <FiSmartphone className="w-5 h-5" />
            <span>接続を開始</span>
          </button>
          <p className="text-sm text-gray-600 mt-2">
            スマホからの接続を待機します
          </p>
        </div>
      )}

      {localDescription && connectionState === 'connecting' && !isScanning && (
        <div className="text-center space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">
              ステップ1: このQRコードをスマホでスキャン
            </h3>
            <QRCodeGenerator data={localDescription} />
          </div>
          
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 mb-2">
              ステップ2: スマホで表示されたQRコードを読み取り
            </h3>
            <button
              onClick={() => setIsScanning(true)}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              <FiSmartphone className="w-4 h-4" />
              <span>スマホのQRコードを読み取り</span>
            </button>
          </div>
        </div>
      )}

      {isScanning && (
        <div className="text-center">
          <h3 className="font-semibold text-gray-900 mb-4">
            スマホで表示されたQRコードを読み取ってください
          </h3>
          <QRCodeScanner onScan={handleScanAnswer} isScanning={isScanning} />
          <button
            onClick={() => setIsScanning(false)}
            className="mt-4 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            キャンセル
          </button>
        </div>
      )}

      {connectionState === 'connected' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <FiWifi className="w-5 h-5 text-green-500" />
            <span className="font-semibold text-green-900">接続完了！</span>
          </div>
          <p className="text-green-800 text-sm">
            スマホから写真を送信できます
          </p>
        </div>
      )}

      {progress > 0 && progress < 100 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">ファイル受信中...</h3>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-sm text-blue-800 mt-1">{Math.round(progress)}%</p>
        </div>
      )}

      {receivedFiles.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900">受信した写真</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {receivedFiles.map((file, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="aspect-square bg-gray-100 rounded-lg mb-3 overflow-hidden">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 truncate">{file.name}</p>
                    <p className="text-sm text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                  <button
                    onClick={() => downloadFile(file)}
                    className="flex items-center space-x-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    <FiDownload className="w-4 h-4" />
                    <span className="hidden sm:inline">ダウンロード</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {connectionState === 'connected' && (
        <div className="text-center">
          <button
            onClick={disconnect}
            className="px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
          >
            接続を切断
          </button>
        </div>
      )}
    </div>
  );
}