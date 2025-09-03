'use client';

import { useState, useRef, useEffect } from 'react';
import { useWebRTC } from '@/hooks/useWebRTC';
import { getConnectionData, storeAnswer } from '@/utils/connectionCode';
import { FiWifi, FiWifiOff, FiImage, FiUpload, FiRefreshCw, FiClock, FiCheckCircle, FiCamera } from 'react-icons/fi';

export function MobileSender() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
  const [connectionCode, setConnectionCode] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState(false);
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

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectionCode.trim()) return;

    setIsConnecting(true);
    try {
      const offerData = await getConnectionData(connectionCode.trim().toUpperCase());
      if (offerData) {
        await handleRemoteDescription(offerData);
      } else {
        alert('接続コードが見つかりません。正しいコードを入力してください。');
      }
    } catch (error) {
      console.error('Connection failed:', error);
      alert('接続に失敗しました。もう一度お試しください。');
    } finally {
      setIsConnecting(false);
    }
  };

  // localDescriptionが設定されたらAnswerとして保存
  useEffect(() => {
    if (localDescription && connectionCode && connectionState === 'connecting') {
      const saveAnswer = async () => {
        try {
          await storeAnswer(connectionCode.trim().toUpperCase(), localDescription);
        } catch (error) {
          console.error('Failed to store answer:', error);
        }
      };
      saveAnswer();
    }
  }, [localDescription, connectionCode, connectionState]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(files);
  };

  const handleSendFiles = async () => {
    if (selectedFiles.length === 0) return;

    for (const file of selectedFiles) {
      try {
        await sendFile(file);
      } catch (error) {
        console.error('Failed to send file:', error);
      }
    }
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
      case 'connected': return 'PCと接続済み';
      case 'connecting': return 'PCに接続中...';
      case 'disconnected': return '未接続';
      default: return '未接続';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-lg mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            WebRTC Photo Drop
          </h1>
          <p className="text-gray-600 text-sm">
            PCに写真を送信しましょう
          </p>
        </header>

        {/* 接続状態 */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              {getConnectionIcon()}
              接続状態
            </h2>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              connectionState === 'connected' ? 'bg-green-100 text-green-800' :
              connectionState === 'connecting' ? 'bg-yellow-100 text-yellow-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {getStatusMessage()}
            </span>
          </div>

          {connectionState === 'disconnected' && (
            <>
              <form onSubmit={handleCodeSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    接続コードを入力
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={connectionCode}
                      onChange={(e) => setConnectionCode(e.target.value.toUpperCase())}
                      placeholder="6桁のコード"
                      maxLength={6}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center font-mono text-lg tracking-widest"
                    />
                    <button
                      type="submit"
                      disabled={isConnecting || connectionCode.length !== 6}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isConnecting ? (
                        <FiRefreshCw className="animate-spin" />
                      ) : (
                        '接続'
                      )}
                    </button>
                  </div>
                </div>
              </form>
              <p className="text-xs text-gray-500 mt-3 text-center">
                PCに表示されている6桁のコードを入力してください
              </p>
            </>
          )}

          {connectionState === 'connecting' && (
            <div className="text-center py-4">
              <FiClock size={32} className="mx-auto text-yellow-500 mb-2" />
              <p className="text-yellow-800 font-medium">接続中...</p>
              <p className="text-sm text-gray-600 mt-1">
                PCとの接続を確立しています
              </p>
            </div>
          )}

          {connectionState === 'connected' && (
            <div className="text-center py-4">
              <FiCheckCircle size={32} className="mx-auto text-green-500 mb-2" />
              <p className="text-green-800 font-medium mb-2">接続完了</p>
              <p className="text-sm text-gray-600 mb-4">
                写真を選択して送信できます
              </p>
              <button
                onClick={disconnect}
                className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 transition-colors"
              >
                切断
              </button>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-4">
              <p className="text-red-800 font-medium text-sm">エラー</p>
              <p className="text-red-600 text-xs">{error}</p>
            </div>
          )}
        </div>

        {/* ファイル選択・送信 */}
        {connectionState === 'connected' && (
          <div className="bg-white rounded-lg shadow-md p-4 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FiImage />
              写真を送信
            </h2>

            <div className="space-y-4">
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 px-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 transition-colors flex flex-col items-center gap-2 text-gray-600 hover:text-blue-600"
                >
                  <FiCamera size={24} />
                  <span className="font-medium">写真を選択</span>
                  <span className="text-xs">タップして写真を選択</span>
                </button>
              </div>

              {selectedFiles.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-700">
                    選択された写真 ({selectedFiles.length}件)
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="relative">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={file.name}
                          className="w-full h-20 object-cover rounded"
                          onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 rounded-b">
                          {(file.size / 1024 / 1024).toFixed(1)}MB
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <button
                    onClick={handleSendFiles}
                    disabled={progress > 0}
                    className="w-full py-2 px-4 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {progress > 0 ? (
                      <>
                        <FiRefreshCw className="animate-spin" />
                        送信中... {progress}%
                      </>
                    ) : (
                      <>
                        <FiUpload />
                        写真を送信
                      </>
                    )}
                  </button>

                  {progress > 0 && (
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="text-center text-xs text-gray-500">
          <p>WebRTC技術を使用してP2P通信</p>
        </div>
      </div>
    </div>
  );
}