/**
 * API Key Cache Service
 * 
 * Singleton service that caches the API key in memory to avoid repeated
 * queries to VSCode settings. Handles undefined/null values properly
 * and tracks initialization state.
 */

interface ApiKeyCache {
  get(): string | undefined;
  set(key: string | undefined): void;
  clear(): void;
  isInitialized(): boolean;
}

class ApiKeyCacheService implements ApiKeyCache {
  private static instance: ApiKeyCacheService;
  private apiKey: string | undefined = undefined;
  private initialized: boolean = false;

  private constructor() {

  }

  public static getInstance(): ApiKeyCacheService {
    if (!ApiKeyCacheService.instance) {
      ApiKeyCacheService.instance = new ApiKeyCacheService();
    }
    return ApiKeyCacheService.instance;
  }

  /**
   * Get the cached API key
   * @returns The cached API key or undefined if not set or not initialized
   * @throws Error if cache access fails
   */
  public get(): string | undefined {
    try {
      return this.apiKey;
    } catch (error) {
      console.error('DebugBuddy: Error accessing cached API key:', error);
      throw new Error(`Cache access failed: ${error}`);
    }
  }

  /**
   * Set the API key in cache
   * @param key The API key to cache (can be undefined/null)
   * @throws Error if cache update fails
   */
  public set(key: string | undefined): void {
    try {
      this.apiKey = key;
      this.initialized = true;
    } catch (error) {
      console.error('DebugBuddy: Error setting API key in cache:', error);
      throw new Error(`Cache update failed: ${error}`);
    }
  }

  /**
   * Clear the cached API key and reset initialization state
   * @throws Error if cache clear fails
   */
  public clear(): void {
    try {
      this.apiKey = undefined;
      this.initialized = false;
    } catch (error) {
      console.error('DebugBuddy: Error clearing API key cache:', error);
      throw new Error(`Cache clear failed: ${error}`);
    }
  }

  /**
   * Check if the cache has been initialized
   * @returns true if the cache has been initialized, false otherwise
   * @throws Error if initialization state check fails
   */
  public isInitialized(): boolean {
    try {
      return this.initialized;
    } catch (error) {
      console.error('DebugBuddy: Error checking cache initialization state:', error);
      throw new Error(`Cache initialization check failed: ${error}`);
    }
  }
}

export const apiKeyCache = ApiKeyCacheService.getInstance();