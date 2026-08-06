import { definePlugin } from 'nitro';
import type { NitroApp } from 'nitro/types';
import { initializeRedis } from '#helper/redisClient.ts';

export default definePlugin(async (_nitroApp: NitroApp) => {
  try {
    await initializeRedis();
  } catch (error) {
    console.error('❌ Redis plugin failed:', error);
  }
});
