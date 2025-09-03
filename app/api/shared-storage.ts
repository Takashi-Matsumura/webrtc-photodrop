// 共有メモリストレージ（全APIエンドポイントで使用）
class SharedConnectionStore {
  private static instance: SharedConnectionStore;
  private store: Map<string, { data: string; expiry: number }>;

  private constructor() {
    this.store = new Map();
  }

  public static getInstance(): SharedConnectionStore {
    if (!SharedConnectionStore.instance) {
      SharedConnectionStore.instance = new SharedConnectionStore();
    }
    return SharedConnectionStore.instance;
  }

  public set(code: string, entry: { data: string; expiry: number }): void {
    this.store.set(code, entry);
  }

  public get(code: string): { data: string; expiry: number } | undefined {
    return this.store.get(code);
  }

  public has(code: string): boolean {
    return this.store.has(code);
  }

  public delete(code: string): boolean {
    return this.store.delete(code);
  }

  public entries(): IterableIterator<[string, { data: string; expiry: number }]> {
    return this.store.entries();
  }

  public keys(): IterableIterator<string> {
    return this.store.keys();
  }

  public get size(): number {
    return this.store.size;
  }

  // Iterable インターフェースを実装
  public [Symbol.iterator](): IterableIterator<[string, { data: string; expiry: number }]> {
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