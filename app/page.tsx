'use client';

import { useState, useEffect } from 'react';
import { PCReceiver } from '@/components/PCReceiver';
import { MobileSender } from '@/components/MobileSender';
import { FiMonitor, FiSmartphone } from 'react-icons/fi';

export default function Home() {
  const [deviceType, setDeviceType] = useState<'pc' | 'mobile' | null>(null);
  const [userSelection, setUserSelection] = useState<'pc' | 'mobile' | null>(null);

  useEffect(() => {
    const checkDevice = () => {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      ) || window.innerWidth < 768;
      setDeviceType(isMobile ? 'mobile' : 'pc');
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  if (!deviceType) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!userSelection) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6 text-center">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">WebRTC Photo Drop</h1>
            <p className="text-gray-600">
              スマートフォンからPCへ直接写真を送信
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-gray-700 font-medium">使用するデバイスを選択してください:</p>
            
            <button
              onClick={() => setUserSelection('pc')}
              className={`w-full p-4 border rounded-lg transition-colors ${
                deviceType === 'pc' 
                  ? 'border-blue-500 bg-blue-50 text-blue-900' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <div className="flex items-center space-x-3">
                <FiMonitor className="w-6 h-6" />
                <div className="text-left flex-1">
                  <div className="font-semibold">PC（受信側）</div>
                  <div className="text-sm text-gray-600">
                    写真を受信してダウンロード
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={() => setUserSelection('mobile')}
              className={`w-full p-4 border rounded-lg transition-colors ${
                deviceType === 'mobile' 
                  ? 'border-blue-500 bg-blue-50 text-blue-900' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <div className="flex items-center space-x-3">
                <FiSmartphone className="w-6 h-6" />
                <div className="text-left flex-1">
                  <div className="font-semibold">スマートフォン（送信側）</div>
                  <div className="text-sm text-gray-600">
                    写真を選択して送信
                  </div>
                </div>
              </div>
            </button>
          </div>

          <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
            <p className="mb-1"><strong>使用方法:</strong></p>
            <ol className="list-decimal list-inside space-y-1 text-left">
              <li>PCで「PC（受信側）」を選択し、6桁の接続コードを表示</li>
              <li>スマホで「スマートフォン（送信側）」を選択</li>
              <li>スマホでPCの6桁コードを入力して接続</li>
              <li>スマホから写真を選択して送信</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 py-4 px-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">WebRTC Photo Drop</h1>
            <p className="text-sm text-gray-600">
              {userSelection === 'pc' ? 'PC（受信側）' : 'スマートフォン（送信側）'}
            </p>
          </div>
          <button
            onClick={() => setUserSelection(null)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            デバイス変更
          </button>
        </div>
      </div>

      <div className="py-6">
        {userSelection === 'pc' ? <PCReceiver /> : <MobileSender />}
      </div>
    </div>
  );
}
