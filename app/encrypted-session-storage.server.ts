import { Session } from "@shopify/shopify-api";
import type { SessionStorage } from "@shopify/shopify-app-session-storage";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import type { PrismaClient } from "@prisma/client";
import { decryptSecret, encryptSecret } from "./utils/encryption.server";

function withEncryptedTokens(session: Session): Session {
  const copy = new Session(session.toObject());
  if (copy.accessToken) copy.accessToken = encryptSecret(copy.accessToken);
  if (copy.refreshToken) copy.refreshToken = encryptSecret(copy.refreshToken);
  return copy;
}

function withDecryptedTokens(session: Session): Session {
  const copy = new Session(session.toObject());
  if (copy.accessToken) copy.accessToken = decryptSecret(copy.accessToken);
  if (copy.refreshToken) copy.refreshToken = decryptSecret(copy.refreshToken);
  return copy;
}

/**
 * Wraps PrismaSessionStorage to encrypt accessToken/refreshToken at rest
 * (AES-256-GCM - see utils/encryption.server.ts) before they ever reach
 * Supabase, and decrypt them on the way back out. Session rows written
 * before this was introduced keep their plaintext tokens readable
 * (decryptSecret passes through anything without the enc:v1: prefix) and
 * get encrypted the next time that session is stored.
 */
export class EncryptedPrismaSessionStorage<T extends PrismaClient>
  implements SessionStorage
{
  private readonly inner: PrismaSessionStorage<T>;

  constructor(prisma: T) {
    this.inner = new PrismaSessionStorage(prisma);
  }

  storeSession(session: Session): Promise<boolean> {
    return this.inner.storeSession(withEncryptedTokens(session));
  }

  async loadSession(id: string): Promise<Session | undefined> {
    const session = await this.inner.loadSession(id);
    return session ? withDecryptedTokens(session) : undefined;
  }

  deleteSession(id: string): Promise<boolean> {
    return this.inner.deleteSession(id);
  }

  deleteSessions(ids: string[]): Promise<boolean> {
    return this.inner.deleteSessions(ids);
  }

  async findSessionsByShop(shop: string): Promise<Session[]> {
    const sessions = await this.inner.findSessionsByShop(shop);
    return sessions.map(withDecryptedTokens);
  }
}
