// 接続データの型定義
export interface ConnectionData {
  offer: string;
  answer?: string;
  expiry: number;
  createdAt: number;
}

// 共有メモリストレージ（全APIエンドポイントで使用）
class SharedConnectionStore {
  private static instance: SharedConnectionStore;
  private store: Map<string, ConnectionData>;

  private constructor() {
    this.store = new Map();
  }

  public static getInstance(): SharedConnectionStore {
    if (!SharedConnectionStore.instance) {
      SharedConnectionStore.instance = new SharedConnectionStore();
    }
    return SharedConnectionStore.instance;
  }

  public set(code: string, entry: ConnectionData): void {
    this.store.set(code, entry);
  }

  public get(code: string): ConnectionData | undefined {
    return this.store.get(code);
  }

  public has(code: string): boolean {
    return this.store.has(code);
  }

  public delete(code: string): boolean {
    return this.store.delete(code);
  }

  public entries(): IterableIterator<[string, ConnectionData]> {
    return this.store.entries();
  }

  public keys(): IterableIterator<string> {
    return this.store.keys();
  }

  public get size(): number {
    return this.store.size;
  }

  // Answerを既存のコードに追加
  public setAnswer(code: string, answer: string): boolean {
    const entry = this.store.get(code);
    if (entry && entry.expiry > Date.now()) {
      entry.answer = answer;
      this.store.set(code, entry);
      return true;
    }
    return false;
  }

  // Offerのみを取得
  public getOffer(code: string): string | null {
    const entry = this.store.get(code);
    if (entry && entry.expiry > Date.now()) {
      return entry.offer;
    }
    return null;
  }

  // Answerのみを取得
  public getAnswer(code: string): string | null {
    const entry = this.store.get(code);
    if (entry && entry.expiry > Date.now() && entry.answer) {
      return entry.answer;
    }
    return null;
  }

  // Answerが利用可能かチェック
  public hasAnswer(code: string): boolean {
    const entry = this.store.get(code);
    return !!(entry && entry.expiry > Date.now() && entry.answer);
  }

  // Iterable インターフェースを実装
  public [Symbol.iterator](): IterableIterator<[string, ConnectionData]> {
    return this.store[Symbol.iterator]();
  }
}

// 期限切れのデータを削除
export function cleanupExpiredData(store: SharedConnectionStore) {
  const now = Date.now();
  const keysToDelete: string[] = [];
  
  for (const [code, entry] of store.entries()) {
    if (entry.expiry < now) {
      keysToDelete.push(code);
    }
  }
  
  keysToDelete.forEach(code => store.delete(code));
}

// ランダムな6桁のコードを生成
export function generateConnectionCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// 共有ストレージのインスタンスをエクスポート
export const connectionStore = SharedConnectionStore.getInstance();