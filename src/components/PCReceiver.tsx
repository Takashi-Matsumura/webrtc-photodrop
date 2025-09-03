'use client';

import { useState, useEffect } from 'react';
import { useWebRTC } from '@/hooks/useWebRTC';
import { storeConnectionData, getAnswer } from '@/utils/connectionCode';
import { FiWifi, FiWifiOff, FiDownload, FiRefreshCw, FiSmartphone, FiCheck, FiClock, FiCopy, FiKey, FiRotateCw, FiX, FiImage } from 'react-icons/fi';

export function PCReceiver() {
  const [receivedFiles, setReceivedFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
  const [connectionCode, setConnectionCode] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageRotation, setImageRotation] = useState(0);

  const {
    connectionState,
    localDescription,
    error,
    disconnectionReason,
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
    setIsGenerating(true);
    try {
      await createOffer();
    } catch (err) {
      console.error('Failed to create offer:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // localDescriptionが設定されたら接続コードを生成
  useEffect(() => {
    if (localDescription && connectionState === 'connecting') {
      const generateCode = async () => {
        try {
          const code = await storeConnectionData(localDescription);
          setConnectionCode(code);
        } catch (error) {
          console.error('Failed to generate connection code:', error);
        }
      };
      generateCode();
    }
  }, [localDescription, connectionState]);

  // 接続コードが生成されたらAnswerをポーリング
  useEffect(() => {
    if (connectionCode && connectionState === 'connecting') {
      const pollForAnswer = async () => {
        try {
          const answer = await getAnswer(connectionCode);
          if (answer) {
            await handleRemoteDescription(answer);
          }
        } catch (error) {
          console.error('Error polling for answer:', error);
        }
      };

      pollForAnswer();
      const interval = setInterval(pollForAnswer, 3000);

      return () => clearInterval(interval);
    }
  }, [connectionCode, connectionState, handleRemoteDescription]);

  const copyToClipboard = async () => {
    if (connectionCode) {
      try {
        await navigator.clipboard.writeText(connectionCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
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

  const getConnectionIcon = () => {
    switch (connectionState) {
      case 'connected': return <FiWifi className="text-green-500" />;
      case 'connecting': return <FiClock className="text-yellow-500" />;
      case 'disconnected': return <FiWifiOff className="text-red-500" />;
      default: return <FiWifiOff className="text-gray-500" />;
    }
  };

  const getStatusMessage = () => {
    switch (connectionState) {
      case 'connected': return 'スマートフォンと接続済み';
      case 'connecting': 
        if (connectionCode) return 'スマートフォンからの接続を待機中...';
        return '接続コードを生成中...';
      case 'disconnected': return '未接続';
      default: return '未接続';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            WebRTC Photo Drop
          </h1>
          <p className="text-gray-600">
            スマートフォンから写真を受け取りましょう
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* 接続パネル */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                {getConnectionIcon()}
                接続状態
              </h2>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                connectionState === 'connected' ? 'bg-green-100 text-green-800' :
                connectionState === 'connecting' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {getStatusMessage()}
              </span>
            </div>

            {connectionState === 'disconnected' && (
              <div className="text-center">
                <button
                  onClick={handleStartConnection}
                  disabled={isGenerating}
                  className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
                >
                  {isGenerating ? (
                    <>
                      <FiRefreshCw className="animate-spin" />
                      接続コード生成中...
                    </>
                  ) : (
                    <>
                      <FiSmartphone />
                      接続を開始
                    </>
                  )}
                </button>
              </div>
            )}

            {connectionCode && connectionState === 'connecting' && (
              <div className="text-center">
                <div className="bg-gray-50 rounded-lg p-6 mb-4">
                  <div className="flex items-center gap-2 justify-center mb-3">
                    <FiKey className="text-blue-600" />
                    <span className="text-sm font-medium text-gray-600">接続コード</span>
                  </div>
                  <div className="text-3xl font-mono font-bold text-gray-900 mb-4 tracking-wider">
                    {connectionCode}
                  </div>
                  <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors mx-auto"
                  >
                    {copied ? <FiCheck className="text-green-600" /> : <FiCopy />}
                    {copied ? 'コピー完了' : 'コードをコピー'}
                  </button>
                </div>
                <p className="text-sm text-gray-600">
                  スマートフォンでこのコードを入力してください
                </p>
              </div>
            )}

            {connectionState === 'connected' && (
              <div className="text-center">
                <div className="text-green-600 mb-4">
                  <FiCheck size={48} className="mx-auto" />
                </div>
                <p className="text-green-800 font-medium mb-4">接続完了</p>
                <p className="text-sm text-gray-600 mb-4">
                  スマートフォンから写真を送信できます
                </p>
                <button
                  onClick={disconnect}
                  className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                >
                  接続を切断
                </button>
              </div>
            )}

            {(error || disconnectionReason === 'peer_disconnected') && (
              <div className={`border rounded-lg p-4 mt-4 ${
                disconnectionReason === 'peer_disconnected' 
                  ? 'bg-yellow-50 border-yellow-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <p className={`font-medium ${
                  disconnectionReason === 'peer_disconnected' 
                    ? 'text-yellow-800' 
                    : 'text-red-800'
                }`}>
                  {disconnectionReason === 'peer_disconnected' ? '接続切断' : 'エラー'}
                </p>
                <p className={`text-sm ${
                  disconnectionReason === 'peer_disconnected' 
                    ? 'text-yellow-700' 
                    : 'text-red-600'
                }`}>
                  {disconnectionReason === 'peer_disconnected' 
                    ? 'スマートフォンとの接続が切断されました' 
                    : error}
                </p>
              </div>
            )}
          </div>

          {/* 受信ファイル一覧 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <FiDownload />
              受信したファイル
            </h2>

            {receivedFiles.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FiDownload size={48} className="mx-auto mb-4 opacity-30" />
                <p>まだファイルを受信していません</p>
              </div>
            ) : (
              <div className="space-y-3">
                {receivedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      {file.type.startsWith('image/') && (
                        <img 
                          src={URL.createObjectURL(file)} 
                          alt={file.name}
                          className="w-12 h-12 object-cover rounded"
                          onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                        />
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{file.name}</p>
                        <p className="text-sm text-gray-500">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedFile(file);
                          setImageRotation(0);
                        }}
                        className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                        title="プレビュー"
                      >
                        <FiImage />
                      </button>
                      <button
                        onClick={() => downloadFile(file)}
                        className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                        title="ダウンロード"
                      >
                        <FiDownload />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {progress > 0 && progress < 100 && (
              <div className="mt-6">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>受信中...</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ファイルプレビューモーダル */}
      {selectedFile && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-4xl max-h-full bg-white rounded-lg shadow-xl">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selectedFile.name}</h3>
                <p className="text-sm text-gray-500">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setImageRotation((prev) => (prev + 90) % 360)}
                  className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  title="回転"
                >
                  <FiRotateCw />
                </button>
                <button
                  onClick={() => downloadFile(selectedFile)}
                  className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                  title="ダウンロード"
                >
                  <FiDownload />
                </button>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                  title="閉じる"
                >
                  <FiX />
                </button>
              </div>
            </div>
            
            <div className="p-4 max-h-[80vh] overflow-auto">
              {selectedFile.type.startsWith('image/') ? (
                <img
                  src={URL.createObjectURL(selectedFile)}
                  alt={selectedFile.name}
                  className="max-w-full max-h-full mx-auto rounded-lg"
                  style={{
                    transform: `rotate(${imageRotation}deg)`,
                    transition: 'transform 0.3s ease'
                  }}
                  onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                />
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <p>画像ファイル以外はプレビューできません</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}