'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import QrScanner from 'qr-scanner';
import { FiCamera, FiUpload, FiAlertCircle, FiRefreshCw, FiAperture } from 'react-icons/fi';

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
  const videoCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'checking' | 'granted' | 'denied' | 'prompt'>('checking');
  const [isPlayingRef, setIsPlayingRef] = useState(false);
  const scannerInitializedRef = useRef(false);
  // const [isManualScanMode, setIsManualScanMode] = useState(true); // 手動スキャンモード - 現在未使用
  const [scanButtonDisabled, setScanButtonDisabled] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false); // スキャン成功フィードバック
  const [forceRestart, setForceRestart] = useState(0); // 強制再始動用カウンタ
  const [isRestarting, setIsRestarting] = useState(false); // 再初期化中フラグ
  const [deviceType, setDeviceType] = useState<'mobile' | 'pc'>('mobile'); // デバイス種別

  // デバイス種別を検知
  useEffect(() => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    ) || window.innerWidth < 768;
    setDeviceType(isMobile ? 'mobile' : 'pc');
    console.log('Device type detected:', isMobile ? 'mobile' : 'pc');
  }, []);

  // 安全な動画再生関数
  const safePlayVideo = async (video: HTMLVideoElement) => {
    if (!video || !video.srcObject || isPlayingRef) {
      return;
    }

    try {
      setIsPlayingRef(true);
      if (video.paused) {
        await video.play();
        console.log('Video playback started successfully');
      }
    } catch (error: unknown) {
      const err = error as Error;
      if (err.name !== 'AbortError') {
        console.error('Video play error:', err.message);
      }
    } finally {
      setTimeout(() => setIsPlayingRef(false), 100);
    }
  };

  useEffect(() => {
    if (!isScanning) {
      scannerInitializedRef.current = false;
      return;
    }

    // 既に初期化中または初期化済みの場合は何もしない
    if (scannerInitializedRef.current) {
      return;
    }
    
    scannerInitializedRef.current = true;
    
    console.log('Initializing camera, forceRestart count:', forceRestart);

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

        // QRスキャナーの初期化（手動モードでは自動スキャンを無効化）
        // デバイスタイプに応じてカメラ設定を変更
        const cameraFacing = deviceType === 'pc' ? 'user' : 'environment';
        console.log(`Initializing QR Scanner with camera facing: ${cameraFacing} for device type: ${deviceType}`);
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        qrScannerRef.current = new (QrScanner as any)(
          videoRef.current,
          // 自動スキャンは使わない（手動スキャン用）
          () => {}, 
          {
            highlightScanRegion: false, // 手動モードでは枠を表示しない
            highlightCodeOutline: false,
            maxScansPerSecond: 0, // 自動スキャンを無効化
            preferredCamera: cameraFacing,
            returnDetailedScanResult: true,
            inversionAttempts: deviceType === 'pc' ? 'both' : 'original', // PC環境では反転も試行
          }
        );
        
        console.log('Starting QR Scanner...');
        await qrScannerRef.current?.start();
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
          
          // 安全な動画再生
          if (video.srcObject) {
            safePlayVideo(video);
          }
          
          console.log('Video display forced - srcObject:', !!video.srcObject, 'paused:', video.paused);
        };
        
        // 初期ビデオ表示設定
        forceVideoDisplay();
        setTimeout(forceVideoDisplay, 500);
        setTimeout(forceVideoDisplay, 1000);
        
        // 定期的なビデオ表示チェック（黒画面防止）
        videoCheckIntervalRef.current = setInterval(() => {
          if (videoRef.current && qrScannerRef.current) {
            forceVideoDisplay();
          }
        }, 2000); // 2秒間隔でチェック

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
        console.log('Camera initialization completed successfully');

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
      console.log('Cleaning up QR Scanner...');
      scannerInitializedRef.current = false;
      
      if (qrScannerRef.current) {
        console.log('Stopping QR Scanner...');
        try {
          qrScannerRef.current.stop();
          qrScannerRef.current.destroy();
        } catch (error) {
          console.log('Error during scanner cleanup:', error);
        }
        qrScannerRef.current = null;
      }
      
      // インターバルのクリーンアップ
      if (videoCheckIntervalRef.current) {
        clearInterval(videoCheckIntervalRef.current);
        videoCheckIntervalRef.current = null;
      }
      
      // MutationObserverのクリーンアップ
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      
      // ビデオ要素をクリーンアップ
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, [isScanning, onScan, shouldStopAfterScan, forceRestart, deviceType]); // forceRestart と deviceType を依存に追加

  // 手動QRスキャン機能
  const handleManualScan = useCallback(async () => {
    if (!videoRef.current || scanButtonDisabled) {
      return;
    }

    setScanButtonDisabled(true);
    console.log('Manual scan triggered...');

    try {
      // ビデオから現在のフレームを取得してQRスキャン
      const canvas = document.createElement('canvas');
      const video = videoRef.current;
      
      // ビデオの状態を確認
      console.log('Video status check:', {
        readyState: video.readyState,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        paused: video.paused,
        srcObject: !!video.srcObject,
        currentTime: video.currentTime
      });
      
      if (video.readyState < 2) {
        console.log('Video not ready for manual scan, readyState:', video.readyState);
        return;
      }
      
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        console.log('Video has no dimensions, cannot scan');
        return;
      }

      const width = video.videoWidth || 320;
      const height = video.videoHeight || 240;
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        console.error('Cannot get canvas context');
        return;
      }

      // ビデオフレームをキャンバスに描画
      ctx.drawImage(video, 0, 0, width, height);
      
      // キャンバスにデータがあるか確認
      const imageData = ctx.getImageData(0, 0, width, height);
      const hasData = imageData.data.some(pixel => pixel > 0);
      const nonZeroPixels = imageData.data.filter(pixel => pixel > 0).length;
      
      console.log('Canvas analysis:', {
        width,
        height,
        hasData,
        nonZeroPixels,
        totalPixels: imageData.data.length,
        dataPercentage: ((nonZeroPixels / imageData.data.length) * 100).toFixed(2) + '%'
      });
      
      if (!hasData) {
        console.error('Canvas is completely empty, no image data to scan');
        console.log('This indicates video frame is not being captured correctly');
        return;
      }
      
      if (nonZeroPixels < (imageData.data.length * 0.01)) {
        console.warn('Canvas has very little data, video might be mostly black');
      }
      
      console.log(`Scanning canvas: ${width}x${height} with ${nonZeroPixels} non-zero pixels`);
      
      // デバッグ用: キャンバスの内容をデータURLとして保存（開発時のみ）
      if (process.env.NODE_ENV === 'development') {
        const dataURL = canvas.toDataURL('image/png');
        console.log('Canvas data URL (for debugging):', dataURL.substring(0, 100) + '...');
        // ブラウザの開発者ツールでこのURLをコピーして新しいタブで開くと画像が見えます
      }
      
      // QRコードをスキャン（型安全な方法）
      let result;
      let qrData;
      
      try {
        // まず通常のスキャンを試行
        console.log('Attempting QR scan on canvas...');
        result = await QrScanner.scanImage(canvas);
        console.log('Manual scan SUCCESS (first try):', result);
        qrData = result;
      } catch (firstError) {
        console.log('First scan attempt failed, trying with image enhancement...');
        
        // PC環境では画像の前処理をより積極的に実行
        const attemptEnhancedScan = async (sourceCanvas: HTMLCanvasElement, enhancement: string) => {
          const enhancedCanvas = document.createElement('canvas');
          enhancedCanvas.width = width;
          enhancedCanvas.height = height;
          const enhancedCtx = enhancedCanvas.getContext('2d', { willReadFrequently: true });
          
          if (!enhancedCtx) return null;
          
          // 元画像をコピー
          enhancedCtx.drawImage(sourceCanvas, 0, 0);
          const imageData = enhancedCtx.getImageData(0, 0, width, height);
          
          switch (enhancement) {
            case 'contrast': {
              // コントラスト強化
              for (let i = 0; i < imageData.data.length; i += 4) {
                const r = imageData.data[i];
                const g = imageData.data[i + 1];
                const b = imageData.data[i + 2];
                
                // コントラスト調整 (factor = 2.0)
                imageData.data[i] = Math.min(255, Math.max(0, (r - 128) * 2 + 128));
                imageData.data[i + 1] = Math.min(255, Math.max(0, (g - 128) * 2 + 128));
                imageData.data[i + 2] = Math.min(255, Math.max(0, (b - 128) * 2 + 128));
              }
              break;
            }
            case 'grayscale': {
              // グレースケール変換
              for (let i = 0; i < imageData.data.length; i += 4) {
                const gray = 0.299 * imageData.data[i] + 0.587 * imageData.data[i + 1] + 0.114 * imageData.data[i + 2];
                imageData.data[i] = gray;
                imageData.data[i + 1] = gray;
                imageData.data[i + 2] = gray;
              }
              break;
            }
            case 'binary': {
              // 二値化
              for (let i = 0; i < imageData.data.length; i += 4) {
                const gray = 0.299 * imageData.data[i] + 0.587 * imageData.data[i + 1] + 0.114 * imageData.data[i + 2];
                const binary = gray > 128 ? 255 : 0;
                imageData.data[i] = binary;
                imageData.data[i + 1] = binary;
                imageData.data[i + 2] = binary;
              }
              break;
            }
            case 'adaptive': {
              // 適応的二値化（簡易版）
              const threshold = 120;
              for (let i = 0; i < imageData.data.length; i += 4) {
                const gray = 0.299 * imageData.data[i] + 0.587 * imageData.data[i + 1] + 0.114 * imageData.data[i + 2];
                const binary = gray > threshold ? 255 : 0;
                imageData.data[i] = binary;
                imageData.data[i + 1] = binary;
                imageData.data[i + 2] = binary;
              }
              break;
            }
          }
          
          enhancedCtx.putImageData(imageData, 0, 0);
          
          try {
            const scanResult = await QrScanner.scanImage(enhancedCanvas);
            console.log(`Manual scan SUCCESS (${enhancement}):`, scanResult);
            return scanResult;
          } catch (error) {
            console.log(`Enhancement method ${enhancement} failed:`, error);
            return null;
          }
        };

        // PC環境では複数の画像処理手法を順次試行
        const enhancementMethods = deviceType === 'pc' 
          ? ['contrast', 'grayscale', 'binary', 'adaptive']
          : ['binary']; // スマホでは基本的な二値化のみ

        for (const method of enhancementMethods) {
          console.log(`Trying enhancement method: ${method}`);
          const enhancedResult = await attemptEnhancedScan(canvas, method);
          if (enhancedResult) {
            result = enhancedResult;
            qrData = result;
            console.log(`Manual scan SUCCESS with ${method} enhancement`);
            break;
          }
        }

        if (!result) {
          // すべての前処理が失敗した場合は最初のエラーを再throw
          throw firstError;
        }
      }
      
      console.log('Final QR Data:', qrData);
      
      if (!qrData) {
        console.error('QR scan succeeded but no data returned');
        return;
      }
      
      // QRコードの内容を解析してチャンク情報を表示
      let scanFeedback = 'QRコードをスキャンしました';
      try {
        const chunkData = JSON.parse(qrData);
        if (chunkData.part && chunkData.total) {
          scanFeedback = `QRコード ${chunkData.part}/${chunkData.total} をスキャンしました`;
          console.log(`QR Chunk scanned: ${chunkData.part}/${chunkData.total}`, chunkData);
        }
      } catch {
        // JSON解析に失敗した場合は通常のQRコード
        console.log('Scanned regular QR code (non-chunk):', qrData);
      }
      
      // 結果をコールバックで返す
      onScan(qrData);
      
      // 成功フィードバックを表示（チャンク情報付き）
      setScanSuccess(true);
      console.log('✅ SCAN SUCCESS:', scanFeedback);
      
      // UI更新用の一時的なメッセージ表示
      const tempMessage = document.createElement('div');
      tempMessage.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #10b981;
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-weight: bold;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      `;
      tempMessage.textContent = scanFeedback;
      document.body.appendChild(tempMessage);
      
      setTimeout(() => {
        setScanSuccess(false);
        if (document.body.contains(tempMessage)) {
          document.body.removeChild(tempMessage);
        }
      }, 2000);
      
      console.log('Manual scan completed successfully');
      
      // QRスキャン成功後にカメラを強制再初期化
      setTimeout(() => {
        console.log('Force restarting camera after successful scan...');
        setForceRestart(prev => prev + 1);
      }, 1000); // 1秒後に再初期化
      
    } catch (error) {
      console.log('❌ SCAN FAILED:');
      console.log('Full error:', error);
      console.log('Error type:', typeof error);
      
      // QrScannerのエラーは文字列として返されることがある
      const errorString = typeof error === 'string' ? error : String(error);
      const errorMessage = error instanceof Error ? error.message : errorString;
      
      console.log('Error string:', errorString);
      console.log('Error message:', errorMessage);
      
      // QRコードが見つからない場合の判定を改善
      let failureMessage = 'QRコードが見つかりません';
      if (errorString.includes('No QR code found') || 
          errorMessage?.includes('No QR code found') ||
          errorString.includes('NotFoundException')) {
        failureMessage = 'QRコードが見つかりません。位置を調整してください';
        console.log('No QR code detected in current frame - this is normal, try positioning the camera better');
      } else {
        failureMessage = 'QRコード読み取りエラーが発生しました';
      }
      
      // 失敗メッセージの表示
      const tempMessage = document.createElement('div');
      tempMessage.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #ef4444;
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-weight: bold;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      `;
      tempMessage.textContent = failureMessage;
      document.body.appendChild(tempMessage);
      
      setTimeout(() => {
        if (document.body.contains(tempMessage)) {
          document.body.removeChild(tempMessage);
        }
      }, 2000);
    } finally {
      // 0.8秒後にボタンを再有効化
      setTimeout(() => {
        setScanButtonDisabled(false);
        console.log('Scan button re-enabled');
      }, 800);
    }
  }, [onScan, scanButtonDisabled, deviceType]);

  const retryCamera = useCallback(() => {
    console.log('Retrying camera initialization...');
    
    // 再試行フラグをリセット
    scannerInitializedRef.current = false;
    
    // 既存のスキャナーをクリーンアップ
    if (qrScannerRef.current) {
      try {
        qrScannerRef.current.stop();
        qrScannerRef.current.destroy();
      } catch (error) {
        console.log('Error during retry cleanup:', error);
      }
      qrScannerRef.current = null;
    }
    
    // ビデオ要素をクリーンアップ
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    // 既存のインターバルをクリーンアップ
    if (videoCheckIntervalRef.current) {
      clearInterval(videoCheckIntervalRef.current);
      videoCheckIntervalRef.current = null;
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

            // QRスキャナーの初期化（手動モード、retry用）
            // デバイスタイプに応じてカメラ設定を変更
            const cameraFacing = deviceType === 'pc' ? 'user' : 'environment';
            console.log(`Retry: Initializing QR Scanner with camera facing: ${cameraFacing} for device type: ${deviceType}`);
            
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            qrScannerRef.current = new (QrScanner as any)(
              videoRef.current,
              // 自動スキャンは使わない（手動スキャン用）
              () => {},
              {
                highlightScanRegion: false, // 手動モードでは枠を表示しない
                highlightCodeOutline: false,
                maxScansPerSecond: 0, // 自動スキャンを無効化
                preferredCamera: cameraFacing,
                returnDetailedScanResult: true,
                inversionAttempts: deviceType === 'pc' ? 'both' : 'original', // PC環境では反転も試行
              }
            );
            
            console.log('Starting QR Scanner...');
            await qrScannerRef.current?.start();
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
              
              // 安全な動画再生
              if (video.srcObject) {
                safePlayVideo(video);
              }
              
              console.log('Video display forced (retry) - srcObject:', !!video.srcObject, 'paused:', video.paused);
            };
            
            // 初期ビデオ表示設定（retry）
            forceVideoDisplay();
            setTimeout(forceVideoDisplay, 500);
            setTimeout(forceVideoDisplay, 1000);
            
            // 定期的なビデオ表示チェック（黒画面防止、retry）
            videoCheckIntervalRef.current = setInterval(() => {
              if (videoRef.current && qrScannerRef.current) {
                forceVideoDisplay();
              }
            }, 2000);
            
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
  }, [isScanning, onScan, shouldStopAfterScan, deviceType]);

  // forceRestart が変更された時に自動的にカメラを再初期化
  useEffect(() => {
    if (forceRestart > 0 && isScanning) {
      console.log('Force restart triggered, reinitializing camera...');
      setIsRestarting(true);
      // 少し遅延してからretryCamera を呼び出し
      setTimeout(() => {
        retryCamera();
        setTimeout(() => setIsRestarting(false), 2000); // 2秒後にフラグをリセット
      }, 100);
    }
  }, [forceRestart, isScanning, retryCamera]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('🔍 Starting file-based QR scan for:', file.name);

    try {
      // 複数の手法でQRコード読み取りを試行
      let result: string | null = null;
      
      // 手法1: 直接ファイルスキャン
      try {
        result = await QrScanner.scanImage(file);
        console.log('✅ Direct file scan SUCCESS:', result);
      } catch (directError) {
        console.log('❌ Direct file scan failed:', directError);
        
        // 手法2: Canvasを使った前処理スキャン
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
            const img = new Image();
            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
              img.src = URL.createObjectURL(file);
            });
            
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            console.log('🎨 Canvas preprocessing: ' + img.width + 'x' + img.height);
            
            // 通常スキャン
            try {
              result = await QrScanner.scanImage(canvas);
              console.log('✅ Canvas scan SUCCESS:', result);
            } catch {
              // コントラスト強化スキャン
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              
              // コントラスト強化
              for (let i = 0; i < imageData.data.length; i += 4) {
                const r = imageData.data[i];
                const g = imageData.data[i + 1];
                const b = imageData.data[i + 2];
                
                imageData.data[i] = Math.min(255, Math.max(0, (r - 128) * 1.5 + 128));
                imageData.data[i + 1] = Math.min(255, Math.max(0, (g - 128) * 1.5 + 128));
                imageData.data[i + 2] = Math.min(255, Math.max(0, (b - 128) * 1.5 + 128));
              }
              
              ctx.putImageData(imageData, 0, 0);
              
              try {
                result = await QrScanner.scanImage(canvas);
                console.log('✅ Enhanced contrast scan SUCCESS:', result);
              } catch {
                console.log('❌ All canvas scan methods failed');
              }
            }
            
            URL.revokeObjectURL(img.src);
          }
        } catch (canvasError) {
          console.log('❌ Canvas preprocessing failed:', canvasError);
        }
      }

      if (result) {
        // QRコードの内容を解析してフィードバック表示
        let scanFeedback = 'QRコード画像を読み取りました';
        try {
          const chunkData = JSON.parse(result);
          if (chunkData.part && chunkData.total) {
            scanFeedback = `画像から QRコード ${chunkData.part}/${chunkData.total} を読み取りました`;
          }
        } catch {
          // 通常のQRコード
        }
        
        // 成功メッセージ表示
        const tempMessage = document.createElement('div');
        tempMessage.style.cssText = `
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: #059669;
          color: white;
          padding: 16px 24px;
          border-radius: 8px;
          font-weight: bold;
          z-index: 10000;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          max-width: 80%;
          text-align: center;
        `;
        tempMessage.textContent = scanFeedback;
        document.body.appendChild(tempMessage);
        
        setTimeout(() => {
          if (document.body.contains(tempMessage)) {
            document.body.removeChild(tempMessage);
          }
        }, 3000);
        
        console.log('✅ FILE SCAN SUCCESS:', scanFeedback);
        onScan(result);
      } else {
        throw new Error('All scan methods failed');
      }
    } catch (error) {
      console.error('❌ All QR scan methods failed:', error);
      
      // 失敗メッセージ表示
      const tempMessage = document.createElement('div');
      tempMessage.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #dc2626;
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        font-weight: bold;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        max-width: 80%;
        text-align: center;
      `;
      tempMessage.textContent = 'QRコードの読み取りに失敗しました。QRコードが鮮明に写っているか確認してください。';
      document.body.appendChild(tempMessage);
      
      setTimeout(() => {
        if (document.body.contains(tempMessage)) {
          document.body.removeChild(tempMessage);
        }
      }, 4000);
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
                <p className="text-white text-xs text-center">QRコードを枠内に合わせてシャッターボタンを押してください</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* コントロール */}
      <div className="flex flex-col items-center space-y-3 w-80">
        {/* 手動シャッターボタン */}
        {hasCamera && !cameraError && !isInitializing && (
          <div className="flex flex-col items-center space-y-3">
            <div className="flex items-center space-x-2 text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
              <FiCamera className="w-4 h-4" />
              <span>カメラ準備完了</span>
            </div>
            
            {/* シャッターボタン */}
            <button
              onClick={handleManualScan}
              disabled={scanButtonDisabled || isRestarting}
              className={`flex items-center justify-center space-x-2 px-6 py-4 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg ${
                scanSuccess 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : isRestarting
                  ? 'bg-orange-600 hover:bg-orange-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              } text-white`}
            >
              <FiAperture className={`w-6 h-6 ${(scanButtonDisabled || isRestarting) ? 'animate-spin' : ''}`} />
              <span className="font-semibold">
                {isRestarting
                  ? 'カメラ再初期化中...'
                  : scanSuccess 
                  ? 'スキャン成功!' 
                  : scanButtonDisabled 
                  ? 'QRコード解析中...' 
                  : 'シャッター（QRスキャン）'
                }
              </span>
            </button>
          </div>
        )}

        {/* ファイルアップロード - カメラ問題の回避策 */}
        <div className="flex flex-col items-center space-y-2 w-full">
          <div className="flex items-center space-x-2 text-sm text-orange-600">
            <span>カメラが動作しない場合の回避策</span>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800">
            <p className="mb-2">📱 <strong>スマホをお使いの場合：</strong></p>
            <p className="mb-2">1. スマホでQRコードの写真を撮影</p>
            <p className="mb-3">2. 下のボタンで撮影した画像を選択</p>
            
            <p className="mb-2">💻 <strong>PCをお使いの場合：</strong></p>
            <p className="mb-2">1. スマホでQRコードの写真を撮影</p>
            <p className="mb-2">2. 画像をPCに送信（メール、クラウド等）</p>
            <p className="mb-3">3. 下のボタンで画像を選択</p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center space-x-2 w-full px-4 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-semibold"
          >
            <FiUpload className="w-5 h-5" />
            <span>QRコード画像を選択して読み取り</span>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* トラブルシューティングとデバッグ情報 */}
        <div className="w-full bg-gray-100 rounded p-3 text-xs">
          <div className="font-semibold text-gray-700 mb-2">🔧 トラブルシューティング</div>
          <div className="space-y-1 text-gray-600">
            <p>デバイス: {deviceType === 'pc' ? 'PC' : 'スマートフォン'}</p>
            <p>カメラ: {hasCamera === null ? '確認中' : hasCamera ? '利用可能' : '利用不可'}</p>
            <p>権限: {permissionStatus === 'granted' ? '許可済み' : permissionStatus === 'denied' ? '拒否' : '確認中'}</p>
            <p>状態: {cameraError ? 'エラー' : isInitializing ? '初期化中' : 'OK'}</p>
            <p>スキャナー: {qrScannerRef.current ? '作成済み' : '未作成'}</p>
          </div>
          
          {cameraError && (
            <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded">
              <p className="font-semibold text-red-700">カメラの問題が発生しています</p>
              <p className="text-red-600 text-xs mt-1">{cameraError}</p>
              <p className="text-red-600 text-xs mt-2">
                👆 上の「QRコード画像を選択して読み取り」ボタンをお試しください
              </p>
            </div>
          )}
          
          {!hasCamera && !isInitializing && (
            <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded">
              <p className="font-semibold text-orange-700">カメラが利用できません</p>
              <p className="text-orange-600 text-xs mt-1">
                画像ファイルアップロード機能をご利用ください
              </p>
            </div>
          )}
        </div>
        
        {/* 開発者向けデバッグ情報 */}
        {process.env.NODE_ENV === 'development' && (
        <div className="w-full bg-blue-50 rounded p-2 text-xs text-blue-600">
          <details>
            <summary className="cursor-pointer font-semibold">🔍 開発者情報</summary>
            <div className="mt-2 space-y-1">
              <p>URL: {`${window.location.protocol}//${window.location.host}`}</p>
              <p>UserAgent: {navigator.userAgent.substring(0, 80)}...</p>
            </div>
          </details>
        </div>
        )}
        
        {/* 開発者向けデバッグボタン */}
        {process.env.NODE_ENV === 'development' && (
        <div className="w-full bg-blue-50 rounded p-2 text-xs text-blue-600">
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
              onClick={handleManualScan}
              className="px-2 py-1 bg-yellow-500 text-white rounded text-xs"
              disabled={scanButtonDisabled}
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
        )}
      </div>
    </div>
  );
}