export interface QRChunk {
  id: string;
  part: number;
  total: number;
  data: string;
  checksum: string;
}

export interface QRDataCollection {
  chunks: Map<number, QRChunk>;
  totalParts: number;
  sessionId: string;
}

/**
 * 簡単なチェックサム生成（CRC32の簡易版）
 */
function generateChecksum(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32bit整数に変換
  }
  return Math.abs(hash).toString(16);
}

/**
 * セッションIDを生成
 */
function generateSessionId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * データを複数のQRチャンクに分割
 */
export function splitDataIntoChunks(data: string, chunkSize: number = 150): QRChunk[] {
  const sessionId = generateSessionId();
  const chunks: QRChunk[] = [];
  const totalParts = Math.ceil(data.length / chunkSize);
  
  console.log(`Splitting data into ${totalParts} chunks (chunk size: ${chunkSize})`);
  
  for (let i = 0; i < totalParts; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, data.length);
    const chunkData = data.substring(start, end);
    
    const chunk: QRChunk = {
      id: sessionId,
      part: i + 1, // 1からスタート
      total: totalParts,
      data: chunkData,
      checksum: generateChecksum(chunkData)
    };
    
    chunks.push(chunk);
  }
  
  return chunks;
}

/**
 * QRチャンクをJSON文字列にシリアライズ
 */
export function chunkToQRString(chunk: QRChunk): string {
  return JSON.stringify(chunk);
}

/**
 * QR文字列をチャンクにデシリアライズ
 */
export function qrStringToChunk(qrString: string): QRChunk | null {
  try {
    const chunk = JSON.parse(qrString) as QRChunk;
    
    // 基本的な検証
    if (!chunk.id || !chunk.part || !chunk.total || !chunk.data || !chunk.checksum) {
      console.error('Invalid chunk format:', chunk);
      return null;
    }
    
    // チェックサム検証
    const calculatedChecksum = generateChecksum(chunk.data);
    if (chunk.checksum !== calculatedChecksum) {
      console.error('Checksum mismatch:', chunk.checksum, 'vs', calculatedChecksum);
      return null;
    }
    
    return chunk;
  } catch (error) {
    console.error('Failed to parse QR string:', error);
    return null;
  }
}

/**
 * QRチャンクコレクション管理クラス
 */
export class QRDataCollector {
  private collections: Map<string, QRDataCollection> = new Map();
  
  /**
   * チャンクを追加
   */
  addChunk(chunk: QRChunk): { isComplete: boolean; sessionId: string; progress: number } {
    const { id: sessionId } = chunk;
    
    if (!this.collections.has(sessionId)) {
      this.collections.set(sessionId, {
        chunks: new Map(),
        totalParts: chunk.total,
        sessionId
      });
    }
    
    const collection = this.collections.get(sessionId)!;
    collection.chunks.set(chunk.part, chunk);
    
    const progress = (collection.chunks.size / collection.totalParts) * 100;
    const isComplete = collection.chunks.size === collection.totalParts;
    
    console.log(`Session ${sessionId}: ${collection.chunks.size}/${collection.totalParts} chunks received (${progress.toFixed(1)}%)`);
    
    return { isComplete, sessionId, progress };
  }
  
  /**
   * 完成したデータを復元
   */
  reconstructData(sessionId: string): string | null {
    const collection = this.collections.get(sessionId);
    if (!collection || collection.chunks.size !== collection.totalParts) {
      console.error('Collection not complete for session:', sessionId);
      return null;
    }
    
    // パート番号順にソートして結合
    const sortedChunks: QRChunk[] = [];
    for (let i = 1; i <= collection.totalParts; i++) {
      const chunk = collection.chunks.get(i);
      if (!chunk) {
        console.error(`Missing chunk ${i} for session ${sessionId}`);
        return null;
      }
      sortedChunks.push(chunk);
    }
    
    const reconstructed = sortedChunks.map(chunk => chunk.data).join('');
    console.log(`Successfully reconstructed data for session ${sessionId} (${reconstructed.length} chars)`);
    
    return reconstructed;
  }
  
  /**
   * セッションの進捗を取得
   */
  getProgress(sessionId: string): { current: number; total: number; progress: number } | null {
    const collection = this.collections.get(sessionId);
    if (!collection) return null;
    
    return {
      current: collection.chunks.size,
      total: collection.totalParts,
      progress: (collection.chunks.size / collection.totalParts) * 100
    };
  }
  
  /**
   * 欠けているチャンク番号を取得
   */
  getMissingChunks(sessionId: string): number[] {
    const collection = this.collections.get(sessionId);
    if (!collection) return [];
    
    const missing: number[] = [];
    for (let i = 1; i <= collection.totalParts; i++) {
      if (!collection.chunks.has(i)) {
        missing.push(i);
      }
    }
    
    return missing;
  }
  
  /**
   * セッションをクリア
   */
  clearSession(sessionId: string): void {
    this.collections.delete(sessionId);
  }
  
  /**
   * 全セッションをクリア
   */
  clearAll(): void {
    this.collections.clear();
  }
}