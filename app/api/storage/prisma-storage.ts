import { prisma } from '../../../lib/prisma';

export interface ConnectionData {
  offer?: string;
  answer?: string;
  expiry: number;
  createdAt: number;
}

export class PrismaStorage {
  async set(code: string, data: ConnectionData): Promise<void> {
    const expiresAt = new Date(data.expiry);
    
    await prisma.connection.upsert({
      where: { code: code.toUpperCase() },
      update: {
        offer: data.offer,
        answer: data.answer,
        expiresAt,
      },
      create: {
        code: code.toUpperCase(),
        offer: data.offer,
        answer: data.answer,
        expiresAt,
      },
    });
  }

  async get(code: string): Promise<ConnectionData | null> {
    const connection = await prisma.connection.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!connection || connection.expiresAt < new Date()) {
      if (connection) {
        await this.delete(code);
      }
      return null;
    }

    return {
      offer: connection.offer || undefined,
      answer: connection.answer || undefined,
      expiry: connection.expiresAt.getTime(),
      createdAt: connection.createdAt.getTime(),
    };
  }

  async delete(code: string): Promise<void> {
    await prisma.connection.delete({
      where: { code: code.toUpperCase() },
    }).catch(() => {});
  }

  async setAnswer(code: string, answer: string): Promise<boolean> {
    const connection = await prisma.connection.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!connection || connection.expiresAt < new Date()) {
      return false;
    }

    await prisma.connection.update({
      where: { code: code.toUpperCase() },
      data: { answer },
    });

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

  async getStats(): Promise<{ totalCodes: number; codes: string[] }> {
    await this.cleanupExpired();
    
    const connections = await prisma.connection.findMany({
      where: {
        expiresAt: { gt: new Date() },
      },
      select: { code: true },
    });

    return {
      totalCodes: connections.length,
      codes: connections.map(c => c.code),
    };
  }

  async cleanupExpired(): Promise<void> {
    await prisma.connection.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
  }
}

export const storage = new PrismaStorage();