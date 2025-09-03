'use client';

import { useState, useEffect } from 'react';
import { useWebRTC } from '@/hooks/useWebRTC';
import { QRCodeGenerator } from './QRCodeGenerator';
import { QRCodeScanner } from './QRCodeScanner';
import { splitDataIntoChunks, chunkToQRString, qrStringToChunk, QRDataCollector, type QRChunk } from '@/utils/qrDataSplitter';
import { storeConnectionData, getConnectionStoreStats, getAnswer } from '@/utils/connectionCode';
import { FiWifi, FiWifiOff, FiDownload, FiRefreshCw, FiSmartphone, FiCheck, FiClock, FiCopy, FiKey } from 'react-icons/fi';

export function PCReceiver() {
  const [receivedFiles, setReceivedFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [qrChunks, setQrChunks] = useState<QRChunk[]>([]);
  const [qrDataCollector] = useState(() => new QRDataCollector());
  const [scannedChunks, setScannedChunks] = useState<Set<number>>(new Set());
  const [answerScanProgress, setAnswerScanProgress] = useState({ current: 0, total: 0, progress: 0 });
  const [currentAnswerSessionId, setCurrentAnswerSessionId] = useState<string>('');
  const [scannedAnswerChunks, setScannedAnswerChunks] = useState<Set<number>>(new Set());
  const [connectionCode, setConnectionCode] = useState<string>('');

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

  // localDescriptionが設定されたらQRコードに分割 + 接続コード生成
  useEffect(() => {
    if (localDescription && connectionState === 'connecting') {
      console.log('Local description available, splitting into QR chunks and generating connection code');
      const chunks = splitDataIntoChunks(localDescription, 150); // PCでは小さなチャンクサイズで読み取りやすくする
      setQrChunks(chunks);
      setScannedChunks(new Set());
      console.log(`Offer split into ${chunks.length} QR chunks`);
      
      // 接続コードを生成（非同期）
      console.log(`PC: About to generate connection code for data length: ${localDescription.length}`);
      const generateCode = async () => {
        try {
          const code = await storeConnectionData(localDescription);
          setConnectionCode(code);
          console.log(`PC: Connection code generated successfully: ${code}`);
          console.log(`PC: Code length: ${code.length}`);
          console.log(`PC: Stored data length: ${localDescription.length}`);
          
          // 即座に検証
          const verification = await getConnectionStoreStats();
          console.log(`PC: Verification - stored codes:`, verification.codes);
          console.log(`PC: Verification - total codes:`, verification.totalCodes);
        } catch (error) {
          console.error(`PC: Error generating connection code:`, error);
          setConnectionCode('ERROR');
        }
      };
      generateCode();
    }
  }, [localDescription, connectionState]);

  // Answerを自動取得するポーリング
  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;
    
    if (connectionCode && connectionState === 'connecting') {
      console.log(`PC: Starting to poll for answer with code: ${connectionCode}`);
      
      const pollForAnswer = async () => {
        try {
          const answer = await getAnswer(connectionCode);
          if (answer) {
            console.log(`PC: ✅ Answer received! Processing connection...`);
            await handleRemoteDescription(answer);
            if (pollInterval) {
              clearInterval(pollInterval);
              pollInterval = null;
            }
          } else {
            console.log(`PC: ⏳ Still waiting for mobile device to connect...`);
          }
        } catch (error) {
          console.error('PC: Error polling for answer:', error);
        }
      };
      
      // 初回実行
      pollForAnswer();
      
      // 3秒間隔でポーリング
      pollInterval = setInterval(pollForAnswer, 3000);
    }
    
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [connectionCode, connectionState, handleRemoteDescription]);

  const handleScanAnswer = (answerData: string) => {
    console.log('PC: Answer QR scanned, data length:', answerData.length);
    console.log('PC: Answer QR data preview:', answerData.substring(0, 100) + '...');
    console.log('PC: Full Answer QR data:', answerData);
    
    try {
      const chunk = qrStringToChunk(answerData);
      console.log('Parsed chunk:', chunk);
      
      if (!chunk) {
        console.error('Failed to parse answer QR chunk');
        return;
      }
      
      console.log(`Adding chunk ${chunk.part}/${chunk.total} to session ${chunk.id}`);
      const result = qrDataCollector.addChunk(chunk);
      console.log('Add chunk result:', result);
      
      setCurrentAnswerSessionId(result.sessionId);
      setAnswerScanProgress({
        current: qrDataCollector.getProgress(result.sessionId)?.current || 0,
        total: qrDataCollector.getProgress(result.sessionId)?.total || 0,
        progress: result.progress
      });
      
      // スキャン済みチャンクを記録
      setScannedAnswerChunks(prev => new Set([...prev, chunk.part]));
      console.log(`Answer chunk ${chunk.part} scanned successfully`);
      
      console.log(`Answer scan progress: ${result.progress.toFixed(1)}% (${qrDataCollector.getProgress(result.sessionId)?.current}/${qrDataCollector.getProgress(result.sessionId)?.total})`);
      
      if (result.isComplete) {
        console.log('All Answer chunks received, reconstructing data...');
        const reconstructedData = qrDataCollector.reconstructData(result.sessionId);
        if (reconstructedData) {
          console.log('Answer data reconstructed successfully, length:', reconstructedData.length);
          handleRemoteDescription(reconstructedData);
          setIsScanning(false);
          qrDataCollector.clearSession(result.sessionId);
          // プログレス状態をリセット
          setAnswerScanProgress({ current: 0, total: 0, progress: 0 });
          setCurrentAnswerSessionId('');
          setScannedAnswerChunks(new Set());
        } else {
          console.error('Failed to reconstruct Answer data');
        }
      } else {
        const missingChunks = qrDataCollector.getMissingChunks(result.sessionId);
        console.log(`Answer progress: ${result.progress.toFixed(1)}%, missing chunks:`, missingChunks);
      }
    } catch (error) {
      // 従来の単一QRコードとして処理
      console.log('Processing answer as single QR code, error:', error);
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

  const copyConnectionCode = () => {
    if (connectionCode) {
      navigator.clipboard.writeText(connectionCode).then(() => {
        // 一時的な成功メッセージ表示
        const button = document.getElementById('copy-button');
        if (button) {
          const originalText = button.textContent;
          button.textContent = 'コピー済み!';
          setTimeout(() => {
            button.textContent = originalText;
          }, 2000);
        }
      });
    }
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
          {/* 接続方法の選択肢 */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-4">
              スマホと接続する方法を選択してください
            </h3>
            
            {/* 接続コード方式（推奨） */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-center space-x-2 mb-3">
                <FiKey className="w-5 h-5 text-green-600" />
                <h4 className="font-semibold text-green-900">方法1: 接続コード（推奨）</h4>
              </div>
              
              {connectionCode && (
                <div className="space-y-3">
                  <div className="bg-white border border-green-300 rounded-lg p-4">
                    <div className="text-4xl font-bold text-green-700 tracking-widest mb-2">
                      {connectionCode}
                    </div>
                    <p className="text-sm text-green-600">
                      この6桁のコードをスマホで入力してください
                    </p>
                  </div>
                  
                  <div className="flex space-x-2 justify-center">
                    <button
                      id="copy-button"
                      onClick={copyConnectionCode}
                      className="inline-flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                    >
                      <FiCopy className="w-4 h-4" />
                      <span>コードをコピー</span>
                    </button>
                    
                    {process.env.NODE_ENV === 'development' && (
                      <div className="flex space-x-1">
                        <button
                          onClick={async () => {
                            const stats = await getConnectionStoreStats();
                            console.log('=== Connection Store Stats ===');
                            console.log(`Total codes: ${stats.totalCodes}`);
                            console.log(`Stored codes:`, stats.codes);
                            console.log('Current connection code:', connectionCode);
                            
                            alert(`デバッグ情報:\n総コード数: ${stats.totalCodes}\n保存済みコード: ${stats.codes.join(', ')}\n現在のコード: ${connectionCode}`);
                          }}
                          className="px-2 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-xs"
                        >
                          Store
                        </button>
                        
                        <button
                          onClick={async () => {
                            // 現在のコードを強制的に再保存
                            if (localDescription) {
                              console.log('=== Force Re-store ===');
                              try {
                                const newCode = await storeConnectionData(localDescription);
                                setConnectionCode(newCode);
                                console.log(`Re-stored with code: ${newCode}`);
                                alert(`コードを再生成しました: ${newCode}`);
                              } catch (error) {
                                console.error('Re-store failed:', error);
                                alert(`再生成失敗: ${error}`);
                              }
                            }
                          }}
                          className="px-2 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-xs"
                        >
                          再生成
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* QRコード方式 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-center space-x-2 mb-3">
              <FiSmartphone className="w-5 h-5 text-blue-600" />
              <h4 className="font-semibold text-blue-900">方法2: QRコードスキャン</h4>
            </div>
            
            <details className="text-left">
              <summary className="cursor-pointer text-blue-700 hover:text-blue-800 text-sm mb-2">
                QRコードを表示する（クリックで展開）
              </summary>
              
              <div className="mt-4">
                <h5 className="font-semibold text-blue-900 mb-4">
                  すべてのQRコードをスマホでスキャンしてください
                </h5>
            
                {/* QRチャンク進捗状況 */}
                <div className="grid grid-cols-5 gap-2 mb-6 max-w-md mx-auto">
              {qrChunks.map((chunk) => (
                <div
                  key={chunk.part}
                  className={`h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                    scannedChunks.has(chunk.part)
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {scannedChunks.has(chunk.part) ? <FiCheck className="w-3 h-3" /> : chunk.part}
                  </div>
                ))}
                </div>
                
                <div className="text-sm text-gray-600 mb-4">
                  進捗: {scannedChunks.size} / {qrChunks.length} 完了
                </div>
            
            {/* 縦並びQRコード表示 */}
            <div className="max-h-96 overflow-y-auto space-y-4 border border-gray-200 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-2">
                下にスクロールして、すべてのQRコードをスキャンしてください
              </div>
              
              {qrChunks.map((chunk) => (
                <div key={chunk.part} className="border-b border-gray-100 pb-4 last:border-b-0">
                  <div className="flex items-center justify-center mb-2">
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                      scannedChunks.has(chunk.part)
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {scannedChunks.has(chunk.part) && <FiCheck className="w-4 h-4 mr-1" />}
                      QRコード {chunk.part} / {chunk.total}
                      {scannedChunks.has(chunk.part) && ' (スキャン済み)'}
                    </div>
                  </div>
                  
                  <QRCodeGenerator 
                    data={chunkToQRString(chunk)}
                    size={300}
                    partNumber={chunk.part}
                    totalParts={chunk.total}
                  />
                </div>
              ))}
            </div>
            
                {scannedChunks.size < qrChunks.length && (
                  <div className="text-orange-600 mt-4">
                    <FiClock className="inline w-4 h-4 mr-1" />
                    スマホですべてのQRコードをスキャンしてください
                  </div>
                )}
              </div>
            </details>
          </div>
          
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 mb-2">
              ステップ2: スマホで表示されたQRコードを読み取り
            </h3>
            <button
              onClick={() => {
                // Answer収集用のコレクターをリセット
                qrDataCollector.clearAll();
                setAnswerScanProgress({ current: 0, total: 0, progress: 0 });
                setCurrentAnswerSessionId('');
                setScannedAnswerChunks(new Set());
                setIsScanning(true);
                console.log('Starting Answer QR scan, collector reset');
              }}
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
                <span className="text-sm text-green-700">Answer スキャン状況</span>
                <span className="text-sm font-semibold text-green-700">
                  {answerScanProgress.current} / {answerScanProgress.total}
                </span>
              </div>
              
              {/* QRチャンク番号の視覚表示 */}
              <div className="grid grid-cols-5 gap-1 mb-3 max-w-xs mx-auto">
                {Array.from({ length: answerScanProgress.total }, (_, i) => i + 1).map((chunkNumber) => (
                  <div
                    key={chunkNumber}
                    className={`h-8 rounded flex items-center justify-center text-xs font-bold transition-all ${
                      scannedAnswerChunks.has(chunkNumber)
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {scannedAnswerChunks.has(chunkNumber) ? <FiCheck className="w-3 h-3" /> : chunkNumber}
                  </div>
                ))}
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
                    残り{answerScanProgress.total - answerScanProgress.current}個のQRコードをスキャンしてください
                  </div>
                ) : (
                  <div className="text-green-600 text-sm">
                    <FiCheck className="inline w-4 h-4 mr-1" />
                    すべてのQRコードをスキャン完了！
                  </div>
                )}
              </div>
              
              {/* 未スキャンのチャンク番号表示 */}
              {answerScanProgress.current < answerScanProgress.total && answerScanProgress.total > 0 && (
                <div className="mt-2 text-center">
                  <span className="text-xs text-gray-500">
                    未スキャン: {Array.from({ length: answerScanProgress.total }, (_, i) => i + 1)
                      .filter(num => !scannedAnswerChunks.has(num))
                      .join(', ')}
                  </span>
                </div>
              )}
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