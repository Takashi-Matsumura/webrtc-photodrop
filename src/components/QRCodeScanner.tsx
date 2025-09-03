'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import QrScanner from 'qr-scanner';
import { FiCamera, FiUpload, FiAlertCircle, FiRefreshCw } from 'react-icons/fi';

interface QRCodeScannerProps {
  onScan: (data: string) => void;
  isScanning: boolean;
  shouldStopAfterScan?: boolean; // マルチQRコードサポートのため
}

export function QRCodeScanner({ onScan, isScanning, shouldStopAfterScan = true }: QRCodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qrScannerRef = useRef<QrScanner | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);
  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'checking' | 'granted' | 'denied' | 'prompt'>('checking');

  useEffect(() => {
    if (!isScanning) return;

    const initCamera = async () => {
      setIsInitializing(true);
      setCameraError('');
      
      try {
        // video要素が利用可能になるまで待機
        let attempts = 0;
        const maxAttempts = 10;
        
        while (!videoRef.current && attempts < maxAttempts) {
          console.log(`Waiting for video element... attempt ${attempts + 1}`);
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }

        if (!videoRef.current) {
          setCameraError('ビデオ要素の初期化に失敗しました。ページを再読み込みしてください。');
          setIsInitializing(false);
          return;
        }

        // カメラの利用可能性をチェック
        const hasCamera = await QrScanner.hasCamera();
        console.log('Camera availability:', hasCamera);
        setHasCamera(hasCamera);

        if (!hasCamera) {
          setCameraError('カメラが見つかりません');
          setIsInitializing(false);
          return;
        }

        // カメラ権限の確認
        if (navigator.permissions) {
          try {
            const permission = await navigator.permissions.query({ name: 'camera' as PermissionName });
            setPermissionStatus(permission.state);
            console.log('Camera permission:', permission.state);
          } catch {
            console.log('Permission API not supported');
          }
        }

        // QRスキャナーの初期化
        qrScannerRef.current = new QrScanner(
          videoRef.current,
          // @ts-expect-error QrScanner types are inconsistent
          (result) => {
            console.log('QR Code detected:', typeof result === 'string' ? result : result.data);
            console.log('QR result details:', result);
            onScan(typeof result === 'string' ? result : result.data);
            
            if (shouldStopAfterScan) {
              qrScannerRef.current?.stop();
            } else {
              // マルチQRコードモードではスキャナーを継続動作させる
              console.log('Multi-QR mode: continuing scan without reset');
            }
          },
          {
            highlightScanRegion: true,
            highlightCodeOutline: true,
            maxScansPerSecond: 2, // スキャン頻度を上げて見逃し防止
            preferredCamera: 'environment',
            returnDetailedScanResult: true,
            inversionAttempts: 'both', // 明暗反転を試行
            calculateScanRegion: (video) => {
              // スキャン領域を中央に集中
              const smallerDimension = Math.min(video.videoWidth, video.videoHeight);
              const scanRegionSize = Math.round(0.8 * smallerDimension); // 80%に拡大
              return {
                x: Math.round((video.videoWidth - scanRegionSize) / 2),
                y: Math.round((video.videoHeight - scanRegionSize) / 2),
                width: scanRegionSize,
                height: scanRegionSize,
              };
            },
          }
        );
        
        console.log('Starting QR Scanner...');
        await qrScannerRef.current.start();
        console.log('QR Scanner started successfully');
        
        // ビデオ表示の強制実行（QrScannerのスタイル制御対策）
        const forceVideoDisplay = () => {
          if (!videoRef.current) return;
          
          console.log('Forcing video display...');
          const video = videoRef.current;
          
          // QrScannerが設定したスタイルを強制的に上書き
          video.style.setProperty('display', 'block', 'important');
          video.style.setProperty('visibility', 'visible', 'important');
          video.style.setProperty('opacity', '1', 'important');
          video.style.setProperty('width', '100%', 'important');
          video.style.setProperty('height', '100%', 'important');
          video.style.setProperty('position', 'static', 'important');
          video.style.setProperty('transform', 'none', 'important');
          video.style.setProperty('object-fit', 'cover', 'important');
          
          // ビデオの再生を確実に行う
          if (video.srcObject && video.paused) {
            video.play().catch(e => console.log('Video play error:', e));
          }
          
          console.log('Video display forced - srcObject:', !!video.srcObject, 'paused:', video.paused);
        };
        
        // 初期ビデオ表示設定
        forceVideoDisplay();
        setTimeout(forceVideoDisplay, 500);
        setTimeout(forceVideoDisplay, 1000);
        
        // MutationObserverでリアルタイムのスタイル変更を監視
        observerRef.current = new MutationObserver((mutations) => {
          let shouldForce = false;
          mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
              shouldForce = true;
            }
          });
          if (shouldForce) {
            setTimeout(forceVideoDisplay, 10);
          }
        });
        
        if (videoRef.current) {
          observerRef.current.observe(videoRef.current, {
            attributes: true,
            attributeFilter: ['style']
          });
        }
        
        setPermissionStatus('granted');
        setIsInitializing(false);

      } catch (error: unknown) {
        console.error('Camera initialization failed:', error);
        setIsInitializing(false);
        
        const err = error as Error;
        if (err.name === 'NotAllowedError') {
          setCameraError('カメラへのアクセスが拒否されました。ブラウザの設定でカメラを許可してください。');
          setPermissionStatus('denied');
        } else if (err.name === 'NotFoundError') {
          setCameraError('カメラが見つかりません。デバイスにカメラが接続されているか確認してください。');
        } else if (err.name === 'NotSupportedError') {
          setCameraError('このブラウザまたはデバイスはカメラをサポートしていません。');
        } else if (err.name === 'NotReadableError') {
          setCameraError('カメラが他のアプリケーションで使用中の可能性があります。');
        } else {
          setCameraError(`初期化エラー: ${err.message || '不明なエラーが発生しました'}`);
        }
        setHasCamera(false);
      }
    };

    initCamera();

    return () => {
      if (qrScannerRef.current) {
        console.log('Stopping QR Scanner...');
        qrScannerRef.current.stop();
        qrScannerRef.current.destroy();
        qrScannerRef.current = null;
      }
      
      // MutationObserverのクリーンアップ
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [isScanning, onScan, shouldStopAfterScan]);

  const retryCamera = useCallback(() => {
    console.log('Retrying camera initialization...');
    
    // 既存のスキャナーをクリーンアップ
    if (qrScannerRef.current) {
      qrScannerRef.current.stop();
      qrScannerRef.current.destroy();
      qrScannerRef.current = null;
    }
    
    // 状態をリセット
    setCameraError('');
    setHasCamera(null);
    setPermissionStatus('checking');
    setIsInitializing(false);
    
    // 少し遅延させてからカメラを再初期化
    setTimeout(() => {
      if (isScanning) {
        const initCamera = async () => {
          setIsInitializing(true);
          setCameraError('');
          
          try {
            // video要素が利用可能になるまで待機
            let attempts = 0;
            const maxAttempts = 10;
            
            while (!videoRef.current && attempts < maxAttempts) {
              console.log(`Waiting for video element... attempt ${attempts + 1}`);
              await new Promise(resolve => setTimeout(resolve, 100));
              attempts++;
            }

            if (!videoRef.current) {
              setCameraError('ビデオ要素の初期化に失敗しました。ページを再読み込みしてください。');
              setIsInitializing(false);
              return;
            }

            // カメラの利用可能性をチェック
            const hasCamera = await QrScanner.hasCamera();
            console.log('Camera availability:', hasCamera);
            setHasCamera(hasCamera);

            if (!hasCamera) {
              setCameraError('カメラが見つかりません');
              setIsInitializing(false);
              return;
            }

            // カメラ権限の確認
            if (navigator.permissions) {
              try {
                const permission = await navigator.permissions.query({ name: 'camera' as PermissionName });
                setPermissionStatus(permission.state);
                console.log('Camera permission:', permission.state);
              } catch {
                console.log('Permission API not supported');
              }
            }

            // QRスキャナーの初期化
            qrScannerRef.current = new QrScanner(
              videoRef.current,
              // @ts-expect-error QrScanner types are inconsistent
          (result) => {
                console.log('QR Code detected:', typeof result === 'string' ? result : result.data);
                console.log('QR result details:', result);
                onScan(typeof result === 'string' ? result : result.data);
                
                if (shouldStopAfterScan) {
                  qrScannerRef.current?.stop();
                } else {
                  // マルチQRコードモードではスキャナーを継続動作させる
                  console.log('Multi-QR mode (retry): continuing scan without reset');
                }
              },
              {
                highlightScanRegion: true,
                highlightCodeOutline: true,
                maxScansPerSecond: 2, // スキャン頻度を上げて見逃し防止
                preferredCamera: 'environment',
                returnDetailedScanResult: true,
                inversionAttempts: 'both', // 明暗反転を試行
                calculateScanRegion: (video) => {
                  // スキャン領域を中央に集中
                  const smallerDimension = Math.min(video.videoWidth, video.videoHeight);
                  const scanRegionSize = Math.round(0.8 * smallerDimension); // 80%に拡大
                  return {
                    x: Math.round((video.videoWidth - scanRegionSize) / 2),
                    y: Math.round((video.videoHeight - scanRegionSize) / 2),
                    width: scanRegionSize,
                    height: scanRegionSize,
                  };
                },
              }
            );
            
            console.log('Starting QR Scanner...');
            await qrScannerRef.current.start();
            console.log('QR Scanner started successfully');
            
            // ビデオ表示の強制実行（QrScannerのスタイル制御対策）
            const forceVideoDisplay = () => {
              if (!videoRef.current) return;
              
              console.log('Forcing video display (retry)...');
              const video = videoRef.current;
              
              // QrScannerが設定したスタイルを強制的に上書き
              video.style.setProperty('display', 'block', 'important');
              video.style.setProperty('visibility', 'visible', 'important');
              video.style.setProperty('opacity', '1', 'important');
              video.style.setProperty('width', '100%', 'important');
              video.style.setProperty('height', '100%', 'important');
              video.style.setProperty('position', 'static', 'important');
              video.style.setProperty('transform', 'none', 'important');
              video.style.setProperty('object-fit', 'cover', 'important');
              
              // ビデオの再生を確実に行う
              if (video.srcObject && video.paused) {
                video.play().catch(e => console.log('Video play error:', e));
              }
              
              console.log('Video display forced (retry) - srcObject:', !!video.srcObject, 'paused:', video.paused);
            };
            
            // 初期ビデオ表示設定（retry）
            forceVideoDisplay();
            setTimeout(forceVideoDisplay, 500);
            setTimeout(forceVideoDisplay, 1000);
            
            // MutationObserverでリアルタイムのスタイル変更を監視
            observerRef.current = new MutationObserver((mutations) => {
              let shouldForce = false;
              mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                  shouldForce = true;
                }
              });
              if (shouldForce) {
                setTimeout(forceVideoDisplay, 10);
              }
            });
            
            if (videoRef.current) {
              observerRef.current.observe(videoRef.current, {
                attributes: true,
                attributeFilter: ['style']
              });
            }
            
            setPermissionStatus('granted');
            setIsInitializing(false);

          } catch (error: unknown) {
            console.error('Camera initialization failed:', error);
            setIsInitializing(false);
            
            const err = error as Error;
            if (err.name === 'NotAllowedError') {
              setCameraError('カメラへのアクセスが拒否されました。ブラウザの設定でカメラを許可してください。');
              setPermissionStatus('denied');
            } else if (err.name === 'NotFoundError') {
              setCameraError('カメラが見つかりません。デバイスにカメラが接続されているか確認してください。');
            } else if (err.name === 'NotSupportedError') {
              setCameraError('このブラウザまたはデバイスはカメラをサポートしていません。');
            } else if (err.name === 'NotReadableError') {
              setCameraError('カメラが他のアプリケーションで使用中の可能性があります。');
            } else {
              setCameraError(`初期化エラー: ${err.message || '不明なエラーが発生しました'}`);
            }
            setHasCamera(false);
          }
        };

        initCamera();
      }
    }, 500);
  }, [isScanning, onScan, shouldStopAfterScan]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const result = await QrScanner.scanImage(file);
      console.log('QR Code from image:', result);
      onScan(result);
    } catch (error) {
      console.error('QR code scan failed:', error);
      alert('QRコードの読み取りに失敗しました。QRコードが含まれている画像かご確認ください。');
    }
  };

  if (!isScanning) {
    return null;
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* 初期化中の表示 */}
      {isInitializing && (
        <div className="flex flex-col items-center justify-center w-80 h-80 bg-gray-100 rounded-lg p-4">
          <FiRefreshCw className="w-8 h-8 text-blue-500 animate-spin mb-2" />
          <p className="text-gray-600 text-center">カメラを初期化中...</p>
          <p className="text-xs text-gray-500 text-center mt-2">
            権限の確認: {permissionStatus}
          </p>
        </div>
      )}

      {/* エラー表示 */}
      {cameraError && (
        <div className="w-80 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <FiAlertCircle className="w-5 h-5 text-red-500" />
            <h3 className="font-semibold text-red-900">カメラエラー</h3>
          </div>
          <p className="text-red-800 text-sm mb-3">{cameraError}</p>
          
          {/* 解決方法のヒント */}
          <div className="bg-red-100 rounded p-2 mb-3">
            <p className="text-xs text-red-700 font-semibold mb-1">解決方法:</p>
            <ul className="text-xs text-red-700 space-y-1">
              {permissionStatus === 'denied' && (
                <>
                  <li>• ブラウザの設定でカメラを許可してください</li>
                  <li>• アドレスバーのカメラアイコンをタップして許可</li>
                  <li>• プライベートブラウジングを無効にしてください</li>
                </>
              )}
              <li>• HTTPSサイトでアクセスしてください</li>
              <li>• 他のアプリでカメラを使用中でないか確認</li>
              <li>• ブラウザを再起動してみてください</li>
            </ul>
          </div>

          <button
            onClick={retryCamera}
            className="flex items-center space-x-2 px-3 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
          >
            <FiRefreshCw className="w-4 h-4" />
            <span>再試行</span>
          </button>
        </div>
      )}

      {/* カメラ表示 */}
      {isScanning && (
        <div className="relative w-80 h-80 bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            style={{ 
              display: 'block',
              visibility: hasCamera && !cameraError && !isInitializing ? 'visible' : 'hidden',
              opacity: hasCamera && !cameraError && !isInitializing ? 1 : 0,
              transform: 'none',
              backgroundColor: '#000',
              position: 'static',
            } as React.CSSProperties}
            playsInline
            autoPlay
            muted
            controls={false}
            width="320"
            height="320"
          />
          {/* スキャン領域の表示 - カメラが動作中のみ */}
          {hasCamera && !cameraError && !isInitializing && (
            <>
              <div className="absolute inset-0 border-2 border-transparent rounded-lg">
                {/* スキャン枠 */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-blue-500 rounded-lg">
                  {/* コーナーマーク */}
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-l-4 border-t-4 border-blue-500 rounded-tl"></div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-r-4 border-t-4 border-blue-500 rounded-tr"></div>
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-l-4 border-b-4 border-blue-500 rounded-bl"></div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-r-4 border-b-4 border-blue-500 rounded-br"></div>
                </div>
              </div>
              
              {/* ステータス表示 */}
              <div className="absolute bottom-2 left-2 right-2 bg-black bg-opacity-50 rounded px-2 py-1">
                <p className="text-white text-xs text-center">QRコードを枠内に合わせてください</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* コントロール */}
      <div className="flex flex-col items-center space-y-3 w-80">
        {hasCamera && !cameraError && (
          <div className="flex items-center space-x-2 text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
            <FiCamera className="w-4 h-4" />
            <span>カメラ準備完了</span>
          </div>
        )}

        {/* ファイルアップロード */}
        <div className="flex flex-col items-center space-y-2 w-full">
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <span>またはファイルから読み取り</span>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center space-x-2 w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <FiUpload className="w-4 h-4" />
            <span>画像ファイルを選択</span>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* デバッグ情報とテスト機能 */}
        <div className="w-full bg-gray-100 rounded p-2 text-xs text-gray-600">
          <p>Debug: hasCamera={String(hasCamera)}, permission={permissionStatus}</p>
          <p>State: error={!!cameraError}, initializing={isInitializing}</p>
          <p>Scanner: {qrScannerRef.current ? 'created' : 'null'}</p>
          <p>URL: {`${window.location.protocol}//${window.location.host}`}</p>
          <div className="mt-2 space-x-2">
            <button 
              onClick={() => {
                console.log('Video element:', videoRef.current);
                console.log('Video playing:', videoRef.current?.srcObject);
                if (videoRef.current) {
                  console.log('Video dimensions:', videoRef.current.videoWidth, 'x', videoRef.current.videoHeight);
                }
              }}
              className="px-2 py-1 bg-blue-500 text-white rounded text-xs"
            >
              Check Video
            </button>
            <button 
              onClick={() => {
                if (videoRef.current) {
                  console.log('Force show clicked - before:', {
                    display: videoRef.current.style.display,
                    visibility: videoRef.current.style.visibility,
                    opacity: videoRef.current.style.opacity,
                    width: videoRef.current.style.width,
                    height: videoRef.current.style.height
                  });
                  
                  videoRef.current.style.setProperty('display', 'block', 'important');
                  videoRef.current.style.setProperty('visibility', 'visible', 'important');
                  videoRef.current.style.setProperty('opacity', '1', 'important');
                  videoRef.current.style.setProperty('width', '100%', 'important');
                  videoRef.current.style.setProperty('height', '100%', 'important');
                  videoRef.current.style.setProperty('position', 'static', 'important');
                  
                  console.log('Force show clicked - after:', {
                    display: videoRef.current.style.display,
                    visibility: videoRef.current.style.visibility,
                    opacity: videoRef.current.style.opacity,
                    width: videoRef.current.style.width,
                    height: videoRef.current.style.height
                  });
                }
              }}
              className="px-2 py-1 bg-green-500 text-white rounded text-xs"
            >
              Force Show
            </button>
            <button 
              onClick={async () => {
                if (videoRef.current && qrScannerRef.current) {
                  try {
                    console.log('Testing QR scan manually...');
                    console.log('Video ready state:', videoRef.current.readyState);
                    console.log('Video dimensions:', videoRef.current.videoWidth, 'x', videoRef.current.videoHeight);
                    console.log('Video current time:', videoRef.current.currentTime);
                    console.log('Video paused:', videoRef.current.paused);
                    
                    if (videoRef.current.readyState < 2) {
                      console.log('Video not ready, waiting...');
                      await new Promise(resolve => {
                        const handler = () => {
                          videoRef.current?.removeEventListener('canplay', handler);
                          resolve(undefined);
                        };
                        videoRef.current?.addEventListener('canplay', handler);
                        setTimeout(() => {
                          videoRef.current?.removeEventListener('canplay', handler);
                          resolve(undefined);
                        }, 2000);
                      });
                    }
                    
                    const canvas = document.createElement('canvas');
                    canvas.width = videoRef.current.videoWidth || 320;
                    canvas.height = videoRef.current.videoHeight || 240;
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                    if (ctx) {
                      ctx.drawImage(videoRef.current, 0, 0);
                      
                      // キャンバスのデータをチェック
                      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                      const hasData = imageData.data.some(pixel => pixel > 0);
                      console.log('Canvas has image data:', hasData);
                      console.log('Canvas dimensions:', canvas.width, 'x', canvas.height);
                      
                      if (hasData) {
                        // 複数の方法でスキャンを試行
                        let scanResult = null;
                        
                        try {
                          console.log('Trying standard scan...');
                          scanResult = await QrScanner.scanImage(canvas);
                          console.log('Standard scan SUCCESS:', scanResult);
                          onScan(scanResult);
                        } catch (error) {
                          console.log('Standard scan failed:', (error as Error).message);
                        }
                        
                        if (!scanResult) {
                          // 画像の前処理を試行
                          console.log('Trying image preprocessing...');
                          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                          
                          // コントラスト強化
                          for (let i = 0; i < imageData.data.length; i += 4) {
                            const gray = 0.299 * imageData.data[i] + 0.587 * imageData.data[i + 1] + 0.114 * imageData.data[i + 2];
                            const enhanced = gray > 128 ? 255 : 0; // 二値化
                            imageData.data[i] = enhanced;
                            imageData.data[i + 1] = enhanced;
                            imageData.data[i + 2] = enhanced;
                          }
                          
                          ctx.putImageData(imageData, 0, 0);
                          
                          try {
                            scanResult = await QrScanner.scanImage(canvas);
                            console.log('Preprocessed scan SUCCESS:', scanResult);
                            onScan(scanResult);
                          } catch (error) {
                            console.log('Preprocessed scan also failed:', (error as Error).message);
                          }
                        }
                      } else {
                        console.log('Canvas is empty, no image data to scan');
                      }
                    }
                  } catch (error) {
                    console.log('Manual scan failed:', error);
                  }
                }
              }}
              className="px-2 py-1 bg-yellow-500 text-white rounded text-xs"
            >
              Test Scan
            </button>
            <button 
              onClick={() => {
                if (videoRef.current) {
                  const canvas = document.createElement('canvas');
                  canvas.width = videoRef.current.videoWidth || 320;
                  canvas.height = videoRef.current.videoHeight || 240;
                  const ctx = canvas.getContext('2d');
                  if (ctx) {
                    ctx.drawImage(videoRef.current, 0, 0);
                    const dataURL = canvas.toDataURL('image/png');
                    const link = document.createElement('a');
                    link.download = 'camera-frame.png';
                    link.href = dataURL;
                    link.click();
                    console.log('Camera frame saved as PNG');
                  }
                }
              }}
              className="px-2 py-1 bg-purple-500 text-white rounded text-xs"
            >
              Save Frame
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}