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

/**
 * Check whether a nested attribute within a parsed JSON value matches the expected value.
 *
 * Steps:
 * 1. Validate that attributePath is a non-empty string.
 * 2. Split the attributePath by '.' to support nested object lookup.
 * 3. Traverse the parsed object following each path segment.
 * 4. If any segment does not exist, return false.
 * 5. After traversal, compare the final value to expectedValue using strict equality.
 */
function matchesAttributeValue(value: unknown, attributePath: string, expectedValue: unknown): boolean {
  // If the attribute path is not a valid non-empty string, we cannot match anything.
  if (typeof attributePath !== 'string' || attributePath.length === 0) {
    return false;
  }

  // Split nested attribute path like "user.email" into ['user', 'email'].
  const pathParts = attributePath.split('.');
  let current: unknown = value;

  for (const part of pathParts) {
    // Ensure the current value is an object and contains the next property.
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      // If any path segment is missing, the attribute cannot match.
      return false;
    }
  }

  // Compare the found nested value with the expected value using strict equality.
  return current === expectedValue;
}

/**
 * Find Redis keys whose JSON values contain an attribute with a matching value.
 */
export async function findRedisJsonByAttribute<T>(pattern: string, attributePath: string, expectedValue: unknown): Promise<Record<string, T>> {
  // Get or initialize the Redis client first.
  const client = await getRedisClient();

  // If Redis is unavailable, return an empty object instead of throwing.
  if (!client) {
    return {};
  }

  const matches: Record<string, T> = {};
  // Use scanIterator to iterate over keys matching the pattern in a memory-efficient way.
  const iterator = client.scanIterator({ MATCH: pattern, COUNT: 100 });

  for await (const key of iterator) {
    // Read the raw string value for this Redis key.
    const rawValue = await client.get((key as unknown) as string);

    // If no value exists, skip this key.
    if (!rawValue) {
      continue;
    }

    try {
      // Parse the stored string as JSON.
      const parsed = JSON.parse(rawValue) as T;

      // If the nested attribute matches, add this key & parsed object to the result.
      if (matchesAttributeValue(parsed, attributePath, expectedValue)) {
        matches[(key as unknown) as string] = parsed;
      }
    } catch {
      // If JSON.parse fails, skip this key and continue scanning.
      continue;
    }
  }

  return matches;
}
