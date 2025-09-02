'use client';

import { useState, useEffect } from 'react';
import { useWebRTC } from '@/hooks/useWebRTC';
import { QRCodeGenerator } from './QRCodeGenerator';
import { QRCodeScanner } from './QRCodeScanner';
import { splitDataIntoChunks, chunkToQRString, qrStringToChunk, QRDataCollector, type QRChunk } from '@/utils/qrDataSplitter';
import { FiWifi, FiWifiOff, FiDownload, FiRefreshCw, FiSmartphone, FiCheck, FiClock } from 'react-icons/fi';

export function PCReceiver() {
  const [receivedFiles, setReceivedFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [qrChunks, setQrChunks] = useState<QRChunk[]>([]);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [qrDataCollector] = useState(() => new QRDataCollector());
  const [scannedChunks, setScannedChunks] = useState<Set<number>>(new Set());
  const [answerScanProgress, setAnswerScanProgress] = useState({ current: 0, total: 0, progress: 0 });
  const [currentAnswerSessionId, setCurrentAnswerSessionId] = useState<string>('');
  const [autoSwitchEnabled, setAutoSwitchEnabled] = useState(true);
  const [switchInterval, setSwitchInterval] = useState(3000); // 3秒間隔

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
    console.log('Offer created, localDescription will be available shortly');
  };

  // localDescriptionが設定されたらQRコードに分割
  useEffect(() => {
    if (localDescription && connectionState === 'connecting') {
      console.log('Local description available, splitting into QR chunks');
      const chunks = splitDataIntoChunks(localDescription, 180);
      setQrChunks(chunks);
      setCurrentChunkIndex(0);
      setScannedChunks(new Set());
      console.log(`Offer split into ${chunks.length} QR chunks`);
    }
  }, [localDescription, connectionState]);

  // 自動QRコード切り替え
  useEffect(() => {
    if (!autoSwitchEnabled || qrChunks.length === 0 || connectionState !== 'connecting') {
      return;
    }

    const interval = setInterval(() => {
      setCurrentChunkIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % qrChunks.length;
        console.log(`Auto-switching QR code: ${prevIndex + 1} -> ${nextIndex + 1}`);
        return nextIndex;
      });
    }, switchInterval);

    return () => clearInterval(interval);
  }, [qrChunks.length, connectionState, autoSwitchEnabled, switchInterval]);

  const handleScanAnswer = (answerData: string) => {
    console.log('Answer QR scanned:', answerData.substring(0, 100) + '...');
    
    try {
      const chunk = qrStringToChunk(answerData);
      if (!chunk) {
        console.error('Failed to parse answer QR chunk');
        return;
      }
      
      const result = qrDataCollector.addChunk(chunk);
      setCurrentAnswerSessionId(result.sessionId);
      setAnswerScanProgress({
        current: qrDataCollector.getProgress(result.sessionId)?.current || 0,
        total: qrDataCollector.getProgress(result.sessionId)?.total || 0,
        progress: result.progress
      });
      
      if (result.isComplete) {
        const reconstructedData = qrDataCollector.reconstructData(result.sessionId);
        if (reconstructedData) {
          console.log('Answer data reconstructed successfully');
          handleRemoteDescription(reconstructedData);
          setIsScanning(false);
          qrDataCollector.clearSession(result.sessionId);
          // プログレス状態をリセット
          setAnswerScanProgress({ current: 0, total: 0, progress: 0 });
          setCurrentAnswerSessionId('');
        }
      } else {
        console.log(`Answer progress: ${result.progress.toFixed(1)}%`);
      }
    } catch {
      // 従来の単一QRコードとして処理
      console.log('Processing answer as single QR code');
      handleRemoteDescription(answerData);
      setIsScanning(false);
    }
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

  const handleNextChunk = () => {
    if (currentChunkIndex < qrChunks.length - 1) {
      setCurrentChunkIndex(prev => prev + 1);
    }
  };
  
  const handlePrevChunk = () => {
    if (currentChunkIndex > 0) {
      setCurrentChunkIndex(prev => prev - 1);
    }
  };
  
  const markChunkAsScanned = (chunkNumber: number) => {
    setScannedChunks(prev => new Set([...prev, chunkNumber]));
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

      {qrChunks.length > 0 && connectionState === 'connecting' && !isScanning && (
        <div className="text-center space-y-4">
          {/* 全体の進捗表示 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-blue-900">
                ステップ1: QRコードをスマホで順次スキャン
              </h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setAutoSwitchEnabled(!autoSwitchEnabled)}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    autoSwitchEnabled
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-300 text-gray-700'
                  }`}
                >
                  {autoSwitchEnabled ? '自動切替ON' : '自動切替OFF'}
                </button>
                <select
                  value={switchInterval}
                  onChange={(e) => setSwitchInterval(Number(e.target.value))}
                  className="px-2 py-1 text-xs border rounded"
                  disabled={!autoSwitchEnabled}
                >
                  <option value={2000}>2秒</option>
                  <option value={3000}>3秒</option>
                  <option value={4000}>4秒</option>
                  <option value={5000}>5秒</option>
                </select>
              </div>
            </div>
            
            {/* QRチャンク一覧 */}
            <div className="grid grid-cols-5 gap-2 mb-4 max-w-md mx-auto">
              {qrChunks.map((chunk, index) => (
                <div
                  key={chunk.part}
                  className={`h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all cursor-pointer ${
                    scannedChunks.has(chunk.part)
                      ? 'bg-green-500 text-white'
                      : index === currentChunkIndex
                      ? 'bg-blue-500 text-white ring-2 ring-blue-300'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                  onClick={() => setCurrentChunkIndex(index)}
                >
                  {scannedChunks.has(chunk.part) ? <FiCheck className="w-3 h-3" /> : chunk.part}
                </div>
              ))}
            </div>
            
            {/* 現在のQRコード */}
            <div className="relative">
              <QRCodeGenerator 
                data={chunkToQRString(qrChunks[currentChunkIndex])}
                partNumber={qrChunks[currentChunkIndex].part}
                totalParts={qrChunks[currentChunkIndex].total}
              />
              
              {/* 自動切り替えインジケーター */}
              {autoSwitchEnabled && (
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-3 py-1 rounded-full text-xs animate-pulse">
                  {Math.ceil(switchInterval / 1000)}秒で自動切替
                </div>
              )}
            </div>
            
            {/* ナビゲーションボタン - 手動モードの場合のみ表示 */}
            {!autoSwitchEnabled && (
              <div className="flex justify-center space-x-4 mt-4">
                <button
                  onClick={handlePrevChunk}
                  disabled={currentChunkIndex === 0}
                  className="px-3 py-2 bg-gray-500 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  ← 前
                </button>
                <button
                  onClick={() => markChunkAsScanned(qrChunks[currentChunkIndex].part)}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                >
                  スキャン完了
                </button>
                <button
                  onClick={handleNextChunk}
                  disabled={currentChunkIndex === qrChunks.length - 1}
                  className="px-3 py-2 bg-gray-500 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  次 →
                </button>
              </div>
            )}
            
            {/* 自動モード時の説明 */}
            {autoSwitchEnabled && (
              <div className="mt-4 text-center text-sm text-blue-600">
                QRコードが自動的に切り替わります。スマホでスキャンしてください。
              </div>
            )}
            
            {/* 進捗情報 */}
            <div className="mt-4 text-sm text-gray-600">
              進捗: {scannedChunks.size} / {qrChunks.length} 完了
              {scannedChunks.size < qrChunks.length && (
                <div className="text-orange-600 mt-1">
                  <FiClock className="inline w-4 h-4 mr-1" />
                  スマホですべてのQRコードをスキャンしてください
                </div>
              )}
            </div>
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
        <div className="text-center space-y-4">
          <h3 className="font-semibold text-gray-900">
            スマホで表示されたQRコードを読み取ってください
          </h3>
          
          {/* Answer スキャン進捗表示 */}
          {answerScanProgress.total > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 max-w-md mx-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-green-700">Answer進捗状況</span>
                <span className="text-sm font-semibold text-green-700">
                  {answerScanProgress.current} / {answerScanProgress.total}
                </span>
              </div>
              <div className="bg-green-200 rounded-full h-3">
                <div 
                  className="bg-green-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${answerScanProgress.progress}%` }}
                ></div>
              </div>
              <div className="text-center mt-2">
                {answerScanProgress.current < answerScanProgress.total ? (
                  <div className="text-green-600 text-sm">
                    <FiClock className="inline w-4 h-4 mr-1" />
                    次のQRコード ({answerScanProgress.current + 1}/{answerScanProgress.total}) をスキャンしてください
                  </div>
                ) : (
                  <div className="text-green-600 text-sm">
                    <FiCheck className="inline w-4 h-4 mr-1" />
                    すべてのQRコードをスキャン完了！
                  </div>
                )}
              </div>
            </div>
          )}
          
          <QRCodeScanner onScan={handleScanAnswer} isScanning={isScanning} shouldStopAfterScan={false} />
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