import { kv } from '@vercel/kv';
import type { ConnectionData } from '../shared-storage';

// Vercel KV を使用した永続化ストレージ
export class VercelKVStorage {
  private keyPrefix = 'webrtc-connection:';
  
  async set(code: string, data: ConnectionData): Promise<void> {
    const key = `${this.keyPrefix}${code.toUpperCase()}`;
    // 24時間のTTLを設定
    await kv.setex(key, 24 * 60 * 60, JSON.stringify(data));
  }
  
  async get(code: string): Promise<ConnectionData | null> {
    const key = `${this.keyPrefix}${code.toUpperCase()}`;
    const result = await kv.get<string>(key);
    if (!result) return null;
    
    try {
      return JSON.parse(result) as ConnectionData;
    } catch {
      return null;
    }
  }
  
  async setAnswer(code: string, answer: string): Promise<boolean> {
    const data = await this.get(code);
    if (!data) return false;
    
    data.answer = answer;
    await this.set(code, data);
    return true;
  }
  
  async getOffer(code: string): Promise<string | null> {
    const data = await this.get(code);
    return data?.offer || null;
  }
  
  async getAnswer(code: string): Promise<string | null> {
    const data = await this.get(code);
    return data?.answer || null;
  }
  
  async hasAnswer(code: string): Promise<boolean> {
    const data = await this.get(code);
    return !!(data?.answer);
  }
  
  async delete(code: string): Promise<void> {
    const key = `${this.keyPrefix}${code.toUpperCase()}`;
    await kv.del(key);
  }
  
  async getAllCodes(): Promise<string[]> {
    const keys = await kv.keys(`${this.keyPrefix}*`);
    return keys.map(key => key.replace(this.keyPrefix, ''));
  }
  
  async getStats(): Promise<{ totalCodes: number; codes: string[] }> {
    const codes = await this.getAllCodes();
    return {
      totalCodes: codes.length,
      codes
    };
  }
}

// シングルトンインスタンス
export const kvStorage = new VercelKVStorage();