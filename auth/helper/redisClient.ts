import { createClient, type RedisClientType } from 'redis';
import { useRuntimeConfig } from 'nitro/runtime-config';

let redisClient: RedisClientType | null = null;
let initializationPromise: Promise<RedisClientType | null> | null = null;

function getRedisUrl(): string | undefined {
  const runtimeConfig = useRuntimeConfig();
  const configuredUrl = (runtimeConfig.redisUrl as string | undefined)?.trim();

  if (configuredUrl) {
    return configuredUrl;
  }

  const host = (runtimeConfig.redisHost as string | undefined)?.trim() || '127.0.0.1';
  const port = Number(runtimeConfig.redisPort as string | undefined ?? 6379);
  const password = (runtimeConfig.redisPassword as string | undefined)?.trim();

  return `redis://${password ? `:${password}@` : ''}${host}:${port}`;
}

export async function initializeRedis(): Promise<RedisClientType | null> {
  if (redisClient) {
    return redisClient;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    const runtimeConfig = useRuntimeConfig();
    const hasRedisConfig = Boolean(
      (runtimeConfig.redisUrl as string | undefined)?.trim() ||
      (runtimeConfig.redisHost as string | undefined)?.trim() ||
      (runtimeConfig.redisPassword as string | undefined)?.trim()
    );

    if (!hasRedisConfig) {
      console.warn('⚠️ Redis is not configured. Skipping Redis initialization.');
      return null;
    }

    const client = createClient({
      url: getRedisUrl(),
      name: 'lms-auth'
    });

    client.on('error', (error: any) => {
      console.error('❌ Redis client error:', error);
    });

    client.on('connect', () => {
      console.log('✅ Redis client connected.');
    });

    client.on('end', () => {
      console.log('ℹ️ Redis client disconnected.');
    });

    try {
      await client.connect();
      redisClient = client;
      return client;
    } catch (error) {
      console.error('❌ Failed to connect to Redis:', error);
      return null;
    }
  })();

  return initializationPromise;
}

export async function getRedisClient(): Promise<RedisClientType | null> {
  return initializeRedis();
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    initializationPromise = null;
  }
}

async function setRedisValue(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
  const client = await getRedisClient();

  if (!client) {
    return false;
  }

  if (ttlSeconds) {
    await client.set(key, value, { EX: ttlSeconds });
  } else {
    await client.set(key, value);
  }

  return true;
}

async function getRedisValue(key: string): Promise<string | null> {
  const client = await getRedisClient();

  if (!client) {
    return null;
  }

  return client.get(key);
}

export async function deleteRedisValue(key: string): Promise<boolean> {
  const client = await getRedisClient();

  if (!client) {
    return false;
  }

  const deleted = await client.del(key);
  return deleted > 0;
}

export async function setRedisJson<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
  return setRedisValue(key, JSON.stringify(value), ttlSeconds);
}

export async function getRedisJson<T>(key: string): Promise<T | null> {
  const rawValue = await getRedisValue(key);

  if (!rawValue) {
    return null;
  }

  return JSON.parse(rawValue) as T;
}
