/**
 * MemoryMonitor - Monitors and optimizes memory usage across the prompt system
 */

import { PromptError } from './types';
import { promptErrorHandler } from './ErrorHandler';

interface MemorySnapshot {
    timestamp: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    arrayBuffers: number;
}

interface MemoryThresholds {
    warning: number;    // MB
    critical: number;   // MB
    cleanup: number;    // MB
}

interface ComponentMemoryUsage {
    name: string;
    estimatedSize: number;
    lastMeasured: number;
}

export class MemoryMonitor {
    private static instance: MemoryMonitor;
    private snapshots: MemorySnapshot[] = [];
    private maxSnapshots: number = 100;
    private monitoringInterval: NodeJS.Timeout | null = null;
    private thresholds: MemoryThresholds = {
        warning: 512,   // 512MB - reasonable for VS Code extensions
        critical: 1024, // 1GB - critical threshold
        cleanup: 768    // 768MB - trigger cleanup
    };
    private components: Map<string, ComponentMemoryUsage> = new Map();
    private cleanupCallbacks: Map<string, () => void> = new Map();
    private isMonitoring: boolean = false;

    private constructor() {
        this.startMonitoring();
    }

    public static getInstance(): MemoryMonitor {
        if (!MemoryMonitor.instance) {
            MemoryMonitor.instance = new MemoryMonitor();
        }
        return MemoryMonitor.instance;
    }

    /**
     * Start memory monitoring
     */
    startMonitoring(intervalMs: number = 300000): void { // 5 minutes instead of 30 seconds
        if (this.isMonitoring) {
            return;
        }

        this.isMonitoring = true;
        this.monitoringInterval = setInterval(() => {
            this.takeSnapshot();
            this.checkThresholds();
        }, intervalMs);

        // Only log in development mode
        if (process.env.NODE_ENV === 'development') {
            promptErrorHandler.logError(
                PromptError.CONFIGURATION_ERROR,
                'Memory monitoring started',
                { intervalMs, thresholds: this.thresholds }
            );
        }
    }

    /**
     * Stop memory monitoring
     */
    stopMonitoring(): void {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        this.isMonitoring = false;

        promptErrorHandler.logError(
            PromptError.CONFIGURATION_ERROR,
            'Memory monitoring stopped',
            {}
        );
    }

    /**
     * Take a memory snapshot
     */
    takeSnapshot(): MemorySnapshot {
        const memUsage = process.memoryUsage();
        const snapshot: MemorySnapshot = {
            timestamp: Date.now(),
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
            external: Math.round(memUsage.external / 1024 / 1024), // MB
            rss: Math.round(memUsage.rss / 1024 / 1024), // MB
            arrayBuffers: Math.round(memUsage.arrayBuffers / 1024 / 1024) // MB
        };

        this.snapshots.push(snapshot);

        // Keep only recent snapshots
        if (this.snapshots.length > this.maxSnapshots) {
            this.snapshots = this.snapshots.slice(-this.maxSnapshots);
        }

        return snapshot;
    }

    /**
     * Get current memory usage
     */
    getCurrentUsage(): MemorySnapshot {
        return this.takeSnapshot();
    }

    /**
     * Get memory usage statistics
     */
    getMemoryStats(): {
        current: MemorySnapshot;
        average: Partial<MemorySnapshot>;
        peak: Partial<MemorySnapshot>;
        trend: 'increasing' | 'decreasing' | 'stable';
        componentUsage: ComponentMemoryUsage[];
    } {
        const current = this.getCurrentUsage();
        
        if (this.snapshots.length === 0) {
            return {
                current,
                average: current,
                peak: current,
                trend: 'stable',
                componentUsage: Array.from(this.components.values())
            };
        }

        // Calculate averages
        const average = this.calculateAverage();
        const peak = this.calculatePeak();
        const trend = this.calculateTrend();

        return {
            current,
            average,
            peak,
            trend,
            componentUsage: Array.from(this.components.values())
        };
    }

    /**
     * Register a component for memory tracking
     */
    registerComponent(name: string, cleanupCallback?: () => void): void {
        this.components.set(name, {
            name,
            estimatedSize: 0,
            lastMeasured: Date.now()
        });

        if (cleanupCallback) {
            this.cleanupCallbacks.set(name, cleanupCallback);
        }

        // Only log in development mode
        if (process.env.NODE_ENV === 'development') {
            promptErrorHandler.logError(
                PromptError.CONFIGURATION_ERROR,
                `Registered component for memory tracking: ${name}`,
                { hasCleanupCallback: !!cleanupCallback }
            );
        }
    }

    /**
     * Update component memory usage
     */
    updateComponentUsage(name: string, estimatedSizeMB: number): void {
        const component = this.components.get(name);
        if (component) {
            component.estimatedSize = estimatedSizeMB;
            component.lastMeasured = Date.now();
        }
    }

    /**
     * Set memory thresholds
     */
    setThresholds(thresholds: Partial<MemoryThresholds>): void {
        this.thresholds = { ...this.thresholds, ...thresholds };
        
        promptErrorHandler.logError(
            PromptError.CONFIGURATION_ERROR,
            'Memory thresholds updated',
            { thresholds: this.thresholds }
        );
    }

    /**
     * Force garbage collection if available
     */
    forceGarbageCollection(): boolean {
        if (global.gc) {
            global.gc();
            promptErrorHandler.logError(
                PromptError.CONFIGURATION_ERROR,
                'Forced garbage collection',
                { memoryBefore: this.getCurrentUsage() }
            );
            return true;
        }
        return false;
    }

    /**
     * Trigger cleanup for all registered components
     */
    triggerCleanup(): void {
        const beforeCleanup = this.getCurrentUsage();
        
        for (const [name, callback] of this.cleanupCallbacks) {
            try {
                callback();
                promptErrorHandler.logError(
                    PromptError.CONFIGURATION_ERROR,
                    `Triggered cleanup for component: ${name}`,
                    {}
                );
            } catch (error) {
                promptErrorHandler.handleError(PromptError.CONFIGURATION_ERROR, {
                    component: name,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    operation: 'cleanup'
                });
            }
        }

        // Force GC after cleanup
        this.forceGarbageCollection();

        const afterCleanup = this.getCurrentUsage();
        const memoryFreed = beforeCleanup.heapUsed - afterCleanup.heapUsed;

        promptErrorHandler.logError(
            PromptError.CONFIGURATION_ERROR,
            `Cleanup completed, freed ${memoryFreed}MB`,
            { beforeCleanup, afterCleanup, memoryFreed }
        );
    }

    /**
     * Get memory health status
     */
    getHealthStatus(): {
        status: 'healthy' | 'warning' | 'critical';
        issues: string[];
        recommendations: string[];
        memoryUsage: MemorySnapshot;
    } {
        const current = this.getCurrentUsage();
        const issues: string[] = [];
        const recommendations: string[] = [];
        let status: 'healthy' | 'warning' | 'critical' = 'healthy';

        if (current.heapUsed > this.thresholds.critical) {
            status = 'critical';
            issues.push(`Critical heap usage: ${current.heapUsed}MB`);
            recommendations.push('Immediate cleanup required');
        } else if (current.heapUsed > this.thresholds.warning) {
            status = 'warning';
            issues.push(`High heap usage: ${current.heapUsed}MB`);
            recommendations.push('Consider running cleanup');
        }

        const stats = this.getMemoryStats();
        if (stats.trend === 'increasing') {
            if (status === 'healthy') {status = 'warning';}
            issues.push('Memory usage is trending upward');
            recommendations.push('Monitor for memory leaks');
        }

        const totalComponentUsage = Array.from(this.components.values())
            .reduce((sum, comp) => sum + comp.estimatedSize, 0);
        
        if (totalComponentUsage > 50) { // 50MB threshold for components
            if (status === 'healthy') {status = 'warning';}
            issues.push(`High component memory usage: ${totalComponentUsage}MB`);
            recommendations.push('Optimize component memory usage');
        }

        return {
            status,
            issues,
            recommendations,
            memoryUsage: current
        };
    }

    /**
     * Get memory optimization suggestions
     */
    getOptimizationSuggestions(): string[] {
        const suggestions: string[] = [];
        const stats = this.getMemoryStats();

        if (stats.current.external > 20) {
            suggestions.push('High external memory usage detected - check for large buffers or native modules');
        }

        const fragmentation = (stats.current.heapTotal - stats.current.heapUsed) / stats.current.heapTotal;
        if (fragmentation > 0.5) {
            suggestions.push('High memory fragmentation - consider forcing garbage collection');
        }

        const inefficientComponents = Array.from(this.components.values())
            .filter(comp => comp.estimatedSize > 10)
            .sort((a, b) => b.estimatedSize - a.estimatedSize);

        if (inefficientComponents.length > 0) {
            suggestions.push(`Optimize high-memory components: ${inefficientComponents.slice(0, 3).map(c => c.name).join(', ')}`);
        }

        if (stats.trend === 'increasing' && this.snapshots.length > 10) {
            const recentGrowth = this.snapshots.slice(-5).reduce((sum, snapshot, index, arr) => {
                if (index === 0) {return 0;}
                return sum + (snapshot.heapUsed - arr[index - 1].heapUsed);
            }, 0);

            if (recentGrowth > 10) { // 10MB growth in recent snapshots
                suggestions.push('Potential memory leak detected - investigate growing memory usage');
            }
        }

        return suggestions;
    }

    /**
     * Export memory data for analysis
     */
    exportMemoryData(): {
        snapshots: MemorySnapshot[];
        components: ComponentMemoryUsage[];
        thresholds: MemoryThresholds;
        stats: any;
    } {
        return {
            snapshots: [...this.snapshots],
            components: Array.from(this.components.values()),
            thresholds: { ...this.thresholds },
            stats: this.getMemoryStats()
        };
    }

    /**
     * Check memory thresholds and trigger actions
     */
    private checkThresholds(): void {
        const current = this.getCurrentUsage();

        if (current.heapUsed > this.thresholds.critical) {
            promptErrorHandler.handleError(PromptError.CONFIGURATION_ERROR, {
                message: 'Critical memory usage detected',
                heapUsed: current.heapUsed,
                threshold: this.thresholds.critical
            });
            
            // Trigger immediate cleanup
            this.triggerCleanup();
        } else if (current.heapUsed > this.thresholds.cleanup) {
            promptErrorHandler.logError(
                PromptError.CONFIGURATION_ERROR,
                'Memory cleanup threshold reached',
                { heapUsed: current.heapUsed, threshold: this.thresholds.cleanup }
            );
            
            // Trigger cleanup
            this.triggerCleanup();
        } else if (current.heapUsed > this.thresholds.warning) {
            promptErrorHandler.logError(
                PromptError.CONFIGURATION_ERROR,
                'Memory warning threshold reached',
                { heapUsed: current.heapUsed, threshold: this.thresholds.warning }
            );
        }
    }

    /**
     * Calculate average memory usage
     */
    private calculateAverage(): Partial<MemorySnapshot> {
        if (this.snapshots.length === 0) {return {};}

        const sums = this.snapshots.reduce((acc, snapshot) => ({
            heapUsed: acc.heapUsed + snapshot.heapUsed,
            heapTotal: acc.heapTotal + snapshot.heapTotal,
            external: acc.external + snapshot.external,
            rss: acc.rss + snapshot.rss,
            arrayBuffers: acc.arrayBuffers + snapshot.arrayBuffers
        }), { heapUsed: 0, heapTotal: 0, external: 0, rss: 0, arrayBuffers: 0 });

        const count = this.snapshots.length;
        return {
            heapUsed: Math.round(sums.heapUsed / count),
            heapTotal: Math.round(sums.heapTotal / count),
            external: Math.round(sums.external / count),
            rss: Math.round(sums.rss / count),
            arrayBuffers: Math.round(sums.arrayBuffers / count)
        };
    }

    /**
     * Calculate peak memory usage
     */
    private calculatePeak(): Partial<MemorySnapshot> {
        if (this.snapshots.length === 0) {return {};}

        return this.snapshots.reduce((peak: Partial<MemorySnapshot>, snapshot) => ({
            heapUsed: Math.max(peak.heapUsed || 0, snapshot.heapUsed),
            heapTotal: Math.max(peak.heapTotal || 0, snapshot.heapTotal),
            external: Math.max(peak.external || 0, snapshot.external),
            rss: Math.max(peak.rss || 0, snapshot.rss),
            arrayBuffers: Math.max(peak.arrayBuffers || 0, snapshot.arrayBuffers)
        }), {} as Partial<MemorySnapshot>);
    }

    /**
     * Calculate memory usage trend
     */
    private calculateTrend(): 'increasing' | 'decreasing' | 'stable' {
        if (this.snapshots.length < 5) {return 'stable';}

        const recent = this.snapshots.slice(-5);
        const older = this.snapshots.slice(-10, -5);

        if (older.length === 0) {return 'stable';}

        const recentAvg = recent.reduce((sum, s) => sum + s.heapUsed, 0) / recent.length;
        const olderAvg = older.reduce((sum, s) => sum + s.heapUsed, 0) / older.length;

        const difference = recentAvg - olderAvg;
        const threshold = 5; // 5MB threshold

        if (difference > threshold) {return 'increasing';}
        if (difference < -threshold) {return 'decreasing';}
        return 'stable';
    }
}