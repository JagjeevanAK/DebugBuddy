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

  public get(): string | undefined {
    try {
      return this.apiKey;
    } catch (error) {
      console.error('DebugBuddy: Error accessing cached API key:', error);
      throw new Error(`Cache access failed: ${error}`);
    }
  }

  public set(key: string | undefined): void {
    try {
      this.apiKey = key;
      this.initialized = true;
    } catch (error) {
      console.error('DebugBuddy: Error setting API key in cache:', error);
      throw new Error(`Cache update failed: ${error}`);
    }
  }

  public clear(): void {
    try {
      this.apiKey = undefined;
      this.initialized = false;
    } catch (error) {
      console.error('DebugBuddy: Error clearing API key cache:', error);
      throw new Error(`Cache clear failed: ${error}`);
    }
  }

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