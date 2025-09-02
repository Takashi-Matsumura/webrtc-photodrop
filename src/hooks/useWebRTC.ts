import { useState, useCallback, useRef } from 'react';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'failed';

export interface FileTransfer {
  name: string;
  size: number;
  chunks: Uint8Array[];
  receivedChunks: number;
  totalChunks: number;
}

export interface UseWebRTCProps {
  stunServers?: string[];
  onFileReceived?: (file: File) => void;
  onProgress?: (progress: number) => void;
}

export function useWebRTC({ stunServers = [], onFileReceived, onProgress }: UseWebRTCProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [localDescription, setLocalDescription] = useState<string>('');
  const [error, setError] = useState<string>('');
  
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const dataChannel = useRef<RTCDataChannel | null>(null);
  const fileTransfer = useRef<FileTransfer | null>(null);

  const setupDataChannel = useCallback((channel: RTCDataChannel) => {
    dataChannel.current = channel;

    channel.onopen = () => {
      console.log('Data channel opened');
    };

    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'file-start') {
          fileTransfer.current = {
            name: data.name,
            size: data.size,
            chunks: new Array(data.totalChunks),
            receivedChunks: 0,
            totalChunks: data.totalChunks
          };
        } else if (data.type === 'file-chunk' && fileTransfer.current) {
          const chunkData = new Uint8Array(atob(data.data).split('').map(char => char.charCodeAt(0)));
          fileTransfer.current.chunks[data.index] = chunkData;
          fileTransfer.current.receivedChunks++;

          const progress = (fileTransfer.current.receivedChunks / fileTransfer.current.totalChunks) * 100;
          onProgress?.(progress);

          if (fileTransfer.current.receivedChunks === fileTransfer.current.totalChunks) {
            const completeData = new Uint8Array(
              fileTransfer.current.chunks.reduce((acc, chunk) => acc + chunk.length, 0)
            );
            let offset = 0;
            for (const chunk of fileTransfer.current.chunks) {
              completeData.set(chunk, offset);
              offset += chunk.length;
            }

            const file = new File([completeData], fileTransfer.current.name, {
              type: 'image/*'
            });
            onFileReceived?.(file);
            fileTransfer.current = null;
          }
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    };

    channel.onerror = (error) => {
      console.error('Data channel error:', error);
      setError('データチャネルエラーが発生しました');
    };
  }, [onFileReceived, onProgress]);

  const createPeerConnection = useCallback(() => {
    // 環境変数からSTUN/TURNサーバーを取得
    const envStunServers = process.env.NEXT_PUBLIC_WEBRTC_STUN_SERVERS?.split(',') || [];
    const envTurnServers = process.env.NEXT_PUBLIC_WEBRTC_TURN_SERVERS?.split(',') || [];
    
    const config: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        ...envStunServers.map(url => ({ urls: url.trim() })),
        ...envTurnServers.map(url => ({ urls: url.trim() })),
        ...stunServers.map(url => ({ urls: url }))
      ]
    };

    const pc = new RTCPeerConnection(config);
    
    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState as ConnectionState);
    };

    pc.onicecandidate = (event) => {
      if (!event.candidate) {
        // ICE gathering complete
        const description = pc.localDescription;
        if (description) {
          setLocalDescription(JSON.stringify(description));
        }
      }
    };

    pc.ondatachannel = (event) => {
      const channel = event.channel;
      setupDataChannel(channel);
    };

    return pc;
  }, [stunServers, setupDataChannel]);

  const createOffer = useCallback(async () => {
    try {
      setError('');
      const pc = createPeerConnection();
      peerConnection.current = pc;
      
      const channel = pc.createDataChannel('fileTransfer');
      setupDataChannel(channel);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      setConnectionState('connecting');
    } catch (error) {
      console.error('Error creating offer:', error);
      setError('Offerの作成に失敗しました');
    }
  }, [createPeerConnection, setupDataChannel]);

  const handleRemoteDescription = useCallback(async (remoteDescriptionJson: string) => {
    try {
      setError('');
      const remoteDescription = JSON.parse(remoteDescriptionJson);
      
      if (!peerConnection.current) {
        const pc = createPeerConnection();
        peerConnection.current = pc;
      }

      await peerConnection.current.setRemoteDescription(remoteDescription);

      if (remoteDescription.type === 'offer') {
        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);
        setConnectionState('connecting');
      }
    } catch (error) {
      console.error('Error handling remote description:', error);
      setError('リモート記述の処理に失敗しました');
    }
  }, [createPeerConnection]);

  const sendFile = useCallback(async (file: File) => {
    if (!dataChannel.current || dataChannel.current.readyState !== 'open') {
      setError('データチャネルが利用できません');
      return;
    }

    const chunkSize = 16384; // 16KB chunks
    const totalChunks = Math.ceil(file.size / chunkSize);

    // Send file metadata
    const fileStart = {
      type: 'file-start',
      name: file.name,
      size: file.size,
      totalChunks
    };
    dataChannel.current.send(JSON.stringify(fileStart));

    // Send file chunks
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);
      const arrayBuffer = await chunk.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const base64 = btoa(String.fromCharCode(...uint8Array));

      const chunkMessage = {
        type: 'file-chunk',
        index: i,
        data: base64
      };

      dataChannel.current.send(JSON.stringify(chunkMessage));
      
      const progress = ((i + 1) / totalChunks) * 100;
      onProgress?.(progress);

      // Small delay to prevent overwhelming the channel
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }, [onProgress]);

  const disconnect = useCallback(() => {
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    if (dataChannel.current) {
      dataChannel.current.close();
      dataChannel.current = null;
    }
    fileTransfer.current = null;
    setConnectionState('disconnected');
    setLocalDescription('');
    setError('');
  }, []);

  return {
    connectionState,
    localDescription,
    error,
    createOffer,
    handleRemoteDescription,
    sendFile,
    disconnect
  };
}