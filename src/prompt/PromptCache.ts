/**
 * PromptCache - High-performance caching system for prompt templates
 * Implements LRU cache with memory monitoring and lazy loading
 */

import { JsonPrompt, PromptError } from './types';
import { promptErrorHandler } from './ErrorHandler';

interface CacheEntry {
    prompt: JsonPrompt;
    lastAccessed: number;
    accessCount: number;
    size: number;
}

interface CacheStats {
    hits: number;
    misses: number;
    evictions: number;
    totalSize: number;
    entryCount: number;
    hitRate: number;
}

export class PromptCache {
    private cache: Map<string, CacheEntry> = new Map();
    private maxSize: number;
    private maxMemoryMB: number;
    private stats: CacheStats = {
        hits: 0,
        misses: 0,
        evictions: 0,
        totalSize: 0,
        entryCount: 0,
        hitRate: 0
    };

    constructor(maxSize: number = 100, maxMemoryMB: number = 50) {
        this.maxSize = maxSize;
        this.maxMemoryMB = maxMemoryMB;
    }

    /**
     * Get a prompt from cache
     */
    get(key: string): JsonPrompt | null {
        const entry = this.cache.get(key);
        
        if (entry) {
            // Update access statistics
            entry.lastAccessed = Date.now();
            entry.accessCount++;
            this.stats.hits++;
            this.updateHitRate();
            
            return entry.prompt;
        }
        
        this.stats.misses++;
        this.updateHitRate();
        return null;
    }

    /**
     * Store a prompt in cache
     */
    set(key: string, prompt: JsonPrompt): void {
        const size = this.calculatePromptSize(prompt);
        
        this.ensureCapacity(size);
        
        const entry: CacheEntry = {
            prompt,
            lastAccessed: Date.now(),
            accessCount: 1,
            size
        };
        
        if (this.cache.has(key)) {
            const oldEntry = this.cache.get(key)!;
            this.stats.totalSize -= oldEntry.size;
        } else {
            this.stats.entryCount++;
        }
        
        this.cache.set(key, entry);
        this.stats.totalSize += size;
    }

    /**
     * Check if a prompt exists in cache
     */
    has(key: string): boolean {
        return this.cache.has(key);
    }

    /**
     * Remove a prompt from cache
     */
    delete(key: string): boolean {
        const entry = this.cache.get(key);
        if (entry) {
            this.cache.delete(key);
            this.stats.totalSize -= entry.size;
            this.stats.entryCount--;
            return true;
        }
        return false;
    }

    /**
     * Clear all cached prompts
     */
    clear(): void {
        this.cache.clear();
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0,
            totalSize: 0,
            entryCount: 0,
            hitRate: 0
        };
    }

    /**
     * Get cache statistics
     */
    getStats(): CacheStats {
        return { ...this.stats };
    }

    /**
     * Get memory usage in MB
     */
    getMemoryUsageMB(): number {
        return this.stats.totalSize / (1024 * 1024);
    }

    /**
     * Check if cache is near memory limit
     */
    isNearMemoryLimit(): boolean {
        return this.getMemoryUsageMB() > (this.maxMemoryMB * 0.8);
    }

    /**
     * Optimize cache by removing least recently used entries
     */
    optimize(): void {
        if (this.cache.size <= this.maxSize && !this.isNearMemoryLimit()) {
            return;
        }

        const entries = Array.from(this.cache.entries());
        
        entries.sort(([, a], [, b]) => {
            const aScore = a.lastAccessed + (a.accessCount * 1000);
            const bScore = b.lastAccessed + (b.accessCount * 1000);
            return aScore - bScore;
        });

        const targetSize = Math.floor(this.maxSize * 0.8);
        const targetMemory = this.maxMemoryMB * 0.7;
        
        while (entries.length > targetSize || this.getMemoryUsageMB() > targetMemory) {
            const [key] = entries.shift()!;
            this.delete(key);
            this.stats.evictions++;
        }

        promptErrorHandler.logError(
            PromptError.CONFIGURATION_ERROR,
            `Cache optimized: evicted ${this.stats.evictions} entries`,
            { 
                currentSize: this.cache.size,
                memoryUsageMB: this.getMemoryUsageMB(),
                targetSize,
                targetMemoryMB: targetMemory
            }
        );
    }

    /**
     * Preload frequently used prompts
     */
    preload(prompts: Map<string, JsonPrompt>): void {
        const frequentlyUsed = ['code-review', 'debug-analysis', 'refactoring'];
        
        for (const [key, prompt] of prompts) {
            if (frequentlyUsed.includes(key) || frequentlyUsed.includes(prompt.id)) {
                this.set(key, prompt);
            }
        }

        promptErrorHandler.logError(
            PromptError.CONFIGURATION_ERROR,
            `Preloaded ${this.cache.size} frequently used prompts`,
            { preloadedKeys: Array.from(this.cache.keys()) }
        );
    }

    /**
     * Calculate the memory size of a prompt in bytes
     */
    private calculatePromptSize(prompt: JsonPrompt): number {
        try {
            const jsonString = JSON.stringify(prompt);
            return new Blob([jsonString]).size;
        } catch (error) {
            const baseSize = 1000; // Base object overhead
            const stringFields = [
                prompt.id, prompt.name, prompt.description,
                prompt.template?.task, prompt.template?.instructions
            ].filter(Boolean);
            
            const stringSize = stringFields.reduce((sum, str) => sum + (str?.length || 0) * 2, 0);
            return baseSize + stringSize;
        }
    }

    /**
     * Ensure cache has capacity for new entry
     */
    private ensureCapacity(newEntrySize: number): void {
        while (this.cache.size >= this.maxSize) {
            this.evictLRU();
        }

        const projectedMemory = (this.stats.totalSize + newEntrySize) / (1024 * 1024);
        while (projectedMemory > this.maxMemoryMB && this.cache.size > 0) {
            this.evictLRU();
        }
    }

    /**
     * Evict least recently used entry
     */
    private evictLRU(): void {
        let oldestKey: string | null = null;
        let oldestTime = Date.now();

        for (const [key, entry] of this.cache) {
            if (entry.lastAccessed < oldestTime) {
                oldestTime = entry.lastAccessed;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.delete(oldestKey);
            this.stats.evictions++;
        }
    }

    /**
     * Update hit rate statistics
     */
    private updateHitRate(): void {
        const total = this.stats.hits + this.stats.misses;
        this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    }

    /**
     * Get cache health metrics
     */
    getHealthMetrics(): {
        healthy: boolean;
        issues: string[];
        recommendations: string[];
    } {
        const issues: string[] = [];
        const recommendations: string[] = [];

        if (this.stats.hitRate < 70 && this.stats.hits + this.stats.misses > 50) {
            issues.push(`Low cache hit rate: ${this.stats.hitRate.toFixed(1)}%`);
            recommendations.push('Consider increasing cache size or preloading more prompts');
        }

        const memoryUsage = this.getMemoryUsageMB();
        if (memoryUsage > this.maxMemoryMB * 0.9) {
            issues.push(`High memory usage: ${memoryUsage.toFixed(1)}MB`);
            recommendations.push('Consider reducing cache size or increasing memory limit');
        }

        const totalOperations = this.stats.hits + this.stats.misses;
        const evictionRate = totalOperations > 0 ? (this.stats.evictions / totalOperations) * 100 : 0;
        if (evictionRate > 10) {
            issues.push(`High eviction rate: ${evictionRate.toFixed(1)}%`);
            recommendations.push('Consider increasing cache size to reduce evictions');
        }

        return {
            healthy: issues.length === 0,
            issues,
            recommendations
        };
    }
}