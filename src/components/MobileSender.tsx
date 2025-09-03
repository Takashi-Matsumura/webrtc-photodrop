'use client';

import { useState, useRef, useEffect } from 'react';
import { useWebRTC } from '@/hooks/useWebRTC';
import { QRCodeGenerator } from './QRCodeGenerator';
import { QRCodeScanner } from './QRCodeScanner';
import { qrStringToChunk, QRDataCollector, chunkToQRString, splitDataIntoChunks, type QRChunk } from '@/utils/qrDataSplitter';
import { FiWifi, FiWifiOff, FiImage, FiUpload, FiRefreshCw, FiMonitor, FiClock, FiCheckCircle } from 'react-icons/fi';

export function MobileSender() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [currentStep, setCurrentStep] = useState<'scan' | 'generate' | 'connected'>('scan');
  const [qrDataCollector] = useState(() => new QRDataCollector());
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0, progress: 0 });
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [scannedOfferChunks, setScannedOfferChunks] = useState<Set<number>>(new Set());
  const [answerQrChunks, setAnswerQrChunks] = useState<QRChunk[]>([]);
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
    console.log('Mobile: Scanned QR data:', offerData.substring(0, 100) + '...');
    console.log('Mobile: isScanning state:', isScanning);
    console.log('Mobile: currentStep:', currentStep);
    
    try {
      const chunk = qrStringToChunk(offerData);
      if (!chunk) {
        console.error('Mobile: Failed to parse QR chunk');
        return;
      }
      
      console.log(`Mobile: Parsed chunk ${chunk.part}/${chunk.total} for session ${chunk.id}`);
      const result = qrDataCollector.addChunk(chunk);
      console.log('Mobile: Add chunk result:', result);
      
      setCurrentSessionId(result.sessionId);
      setScanProgress({
        current: qrDataCollector.getProgress(result.sessionId)?.current || 0,
        total: qrDataCollector.getProgress(result.sessionId)?.total || 0,
        progress: result.progress
      });
      
      // スキャン済みチャンクを記録
      setScannedOfferChunks(prev => new Set([...prev, chunk.part]));
      console.log(`Mobile: Offer chunk ${chunk.part} scanned successfully, continuing scan mode`);
      
      if (result.isComplete) {
        console.log('Mobile: All Offer chunks received, reconstructing...');
        const reconstructedOffer = qrDataCollector.reconstructData(result.sessionId);
        if (reconstructedOffer) {
          console.log('Mobile: Offer data reconstructed successfully, stopping scan');
          await handleRemoteDescription(reconstructedOffer);
          setIsScanning(false);
          setCurrentStep('generate');
          
          qrDataCollector.clearSession(result.sessionId);
          // スキャン状態をリセット
          setScannedOfferChunks(new Set());
        }
      } else {
        const missingChunks = qrDataCollector.getMissingChunks(result.sessionId);
        console.log(`Mobile: Still need chunks: ${missingChunks.join(', ')}`);
      }
    } catch (error) {
      // 従来の単一QRコードとして処理
      console.log('Mobile: Processing as single QR code, error:', error);
      await handleRemoteDescription(offerData);
      setIsScanning(false);
      setCurrentStep('generate');
    }
  };

  // localDescriptionが設定されたらAnswerを分割
  useEffect(() => {
    if (localDescription && currentStep === 'generate' && connectionState === 'connecting') {
      console.log('Mobile: Local description available, splitting Answer data into chunks...');
      console.log('Mobile: Answer data length:', localDescription.length);
      console.log('Mobile: Answer data preview:', localDescription.substring(0, 200));
      const answerChunks = splitDataIntoChunks(localDescription, 150); // PCで読み取りやすいサイズに統一
      setAnswerQrChunks(answerChunks);
      console.log(`Mobile: Answer split into ${answerChunks.length} QR chunks`);
      
      // 各チャンクの内容をログ出力
      answerChunks.forEach((chunk, index) => {
        console.log(`Mobile: Answer chunk ${index + 1}:`, {
          part: chunk.part,
          total: chunk.total,
          id: chunk.id,
          dataLength: chunk.data.length,
          checksum: chunk.checksum
        });
      });
    }
  }, [localDescription, currentStep, connectionState]);

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
    <div className="max-w-lg mx-auto p-3 space-y-4">
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
            
            {/* スキャン進捗表示 */}
            {scanProgress.total > 0 && (
              <div className="mb-4 text-left">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-blue-700">スキャン状況</span>
                  <span className="text-sm font-semibold text-blue-700">
                    {scanProgress.current} / {scanProgress.total}
                  </span>
                </div>
                
                {/* QRチャンク番号の視覚表示 */}
                <div className="grid grid-cols-5 gap-1 mb-3 max-w-xs mx-auto">
                  {Array.from({ length: scanProgress.total }, (_, i) => i + 1).map((chunkNumber) => (
                    <div
                      key={chunkNumber}
                      className={`h-8 rounded flex items-center justify-center text-xs font-bold transition-all ${
                        scannedOfferChunks.has(chunkNumber)
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {scannedOfferChunks.has(chunkNumber) ? <FiCheckCircle className="w-3 h-3" /> : chunkNumber}
                    </div>
                  ))}
                </div>
                
                <div className="bg-blue-200 rounded-full h-3">
                  <div 
                    className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${scanProgress.progress}%` }}
                  ></div>
                </div>
                
                <div className="text-center mt-2">
                  {scanProgress.current < scanProgress.total ? (
                    <div className="text-blue-600 text-sm">
                      <FiClock className="inline w-4 h-4 mr-1" />
                      残り{scanProgress.total - scanProgress.current}個のQRコードをスキャンしてください
                    </div>
                  ) : (
                    <div className="text-green-600 text-sm">
                      <FiCheckCircle className="inline w-4 h-4 mr-1" />
                      すべてのQRコードをスキャン完了
                    </div>
                  )}
                </div>
                
                {/* 未スキャンのチャンク番号表示 */}
                {scanProgress.current < scanProgress.total && scanProgress.total > 0 && (
                  <div className="mt-2 text-center">
                    <span className="text-xs text-gray-500">
                      未スキャン: {Array.from({ length: scanProgress.total }, (_, i) => i + 1)
                        .filter(num => !scannedOfferChunks.has(num))
                        .join(', ')}
                    </span>
                  </div>
                )}
              </div>
            )}
            
            <button
              onClick={() => {
                console.log('Mobile: Starting QR scan...');
                // スキャン状態をリセット
                qrDataCollector.clearAll();
                setScannedOfferChunks(new Set());
                setScanProgress({ current: 0, total: 0, progress: 0 });
                setCurrentSessionId('');
                setIsScanning(true);
              }}
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
          <QRCodeScanner onScan={handleScanOffer} isScanning={isScanning} shouldStopAfterScan={false} />
          <button
            onClick={() => setIsScanning(false)}
            className="mt-4 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            キャンセル
          </button>
        </div>
      )}

      {currentStep === 'generate' && localDescription && connectionState === 'connecting' && (
        <div className="text-center space-y-3">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <h3 className="font-semibold text-green-900 mb-4">
              以下のQRコードをPCで読み取ってください
            </h3>
            
            {answerQrChunks.length > 0 ? (
              <div>
                {/* 縦並びQRコード表示 */}
                <div className="max-h-96 overflow-y-auto space-y-3 border border-gray-200 rounded-lg p-3">
                  <div className="text-sm text-gray-600 mb-2">
                    下にスクロールして、すべてのQRコードをPCで読み取ってください
                  </div>
                  
                  {answerQrChunks.map((chunk) => (
                    <div key={chunk.part} className="border-b border-gray-100 pb-3 last:border-b-0">
                      <div className="flex items-center justify-center mb-2">
                        <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-700">
                          QRコード {chunk.part} / {chunk.total}
                        </div>
                      </div>
                      
                      <QRCodeGenerator 
                        data={chunkToQRString(chunk)}
                        size={250}
                        partNumber={chunk.part}
                        totalParts={chunk.total}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <QRCodeGenerator data={localDescription} size={280} />
            )}
            
            <p className="text-sm text-green-800 mt-3">
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