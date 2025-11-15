/**
 * Performance benchmarks and tests for the prompt system
 * Manual test runner for performance validation
 */

import { PromptCache } from '../prompt/PromptCache';
import { LazyPromptLoader } from '../prompt/LazyPromptLoader';
import { OptimizedTemplateEngine } from '../prompt/OptimizedTemplateEngine';
import { MemoryMonitor } from '../prompt/MemoryMonitor';
import { JsonPrompt, VariableMap, PromptCategory } from '../prompt/types';

// Helper function to create test prompts
function createTestPrompt(id: string): JsonPrompt {
    return {
        id,
        name: `Test Prompt ${id}`,
        description: `Test prompt for ${id}`,
        category: PromptCategory.GENERAL,
        version: '1.0.0',
        schema_version: '1.0.0',
        template: {
            task: 'test_task',
            context: {},
            instructions: 'Test instructions for ${code}',
            output_format: {
                structure: 'test',
                include_line_numbers: false,
                include_severity: false,
                include_explanation: true,
                include_fix_suggestion: false
            },
            variables: ['code', 'language']
        },
        config: {
            configurable_fields: [],
            default_values: {},
            validation_rules: {}
        },
        metadata: {
            supported_languages: ['javascript', 'typescript'],
            required_context: ['code'],
            performance_notes: 'Test prompt'
        }
    };
}

// Performance test functions
export class PerformanceTests {
    private cache: PromptCache;
    private lazyLoader: LazyPromptLoader;
    private templateEngine: OptimizedTemplateEngine;
    private memoryMonitor: MemoryMonitor;

    constructor() {
        this.cache = new PromptCache(100, 50);
        this.lazyLoader = new LazyPromptLoader(this.cache);
        this.templateEngine = new OptimizedTemplateEngine();
        this.memoryMonitor = MemoryMonitor.getInstance();
    }

    async runAllTests(): Promise<void> {
        console.log('Starting performance tests...');
        
        this.memoryMonitor.startMonitoring(1000);
        
        try {
            await this.testCachePerformance();
            await this.testTemplateEnginePerformance();
            await this.testMemoryMonitoring();
            await this.testIntegrationPerformance();
            
            console.log('All performance tests completed successfully!');
        } catch (error) {
            console.error('Performance tests failed:', error);
        } finally {
            this.cleanup();
        }
    }

    private async testCachePerformance(): Promise<void> {
        console.log('Testing cache performance...');
        
        const startTime = performance.now();
        const iterations = 10000;
        
        // Create test prompts
        const prompts: JsonPrompt[] = [];
        for (let i = 0; i < 100; i++) {
            prompts.push(createTestPrompt(`test-${i}`));
        }

        // Perform cache operations
        for (let i = 0; i < iterations; i++) {
            const prompt = prompts[i % prompts.length];
            this.cache.set(prompt.id, prompt);
            this.cache.get(prompt.id);
        }

        const endTime = performance.now();
        const duration = endTime - startTime;
        const operationsPerSecond = (iterations * 2) / (duration / 1000);

        console.log(`Cache performance: ${operationsPerSecond.toFixed(0)} ops/sec`);
        
        if (operationsPerSecond < 10000) {
            console.warn('Cache performance below expected threshold');
        }

        const stats = this.cache.getStats();
        console.log(`Cache hit rate: ${stats.hitRate.toFixed(1)}%`);
    }

    private async testTemplateEnginePerformance(): Promise<void> {
        console.log('Testing template engine performance...');
        
        const prompt = createTestPrompt('large-context-test');
        prompt.template.instructions = 'Analyze this code: ${code}\nLanguage: ${language}\nFocus on: ${focusAreas}';

        const largeCode = 'function test() {\n' + '  console.log("test");\n'.repeat(1000) + '}';
        const variables: VariableMap = {
            code: largeCode,
            language: 'javascript',
            focusAreas: ['performance', 'security']
        };

        const startTime = performance.now();
        
        // Process multiple times to test caching
        for (let i = 0; i < 10; i++) {
            this.templateEngine.processTemplate(prompt, variables);
        }
        
        const endTime = performance.now();
        const duration = endTime - startTime;

        console.log(`Template engine processing time: ${duration.toFixed(2)}ms`);
        
        const metrics = this.templateEngine.getPerformanceMetrics();
        console.log(`Template cache hit rate: ${metrics.cacheHitRate.toFixed(1)}%`);
        console.log(`Average processing time: ${metrics.averageProcessingTime.toFixed(2)}ms`);
    }

    private async testMemoryMonitoring(): Promise<void> {
        console.log('Testing memory monitoring...');
        
        const startTime = performance.now();
        
        // Take multiple snapshots
        for (let i = 0; i < 100; i++) {
            this.memoryMonitor.takeSnapshot();
        }

        const endTime = performance.now();
        const duration = endTime - startTime;

        console.log(`Memory monitoring overhead: ${duration.toFixed(2)}ms for 100 snapshots`);
        
        const stats = this.memoryMonitor.getMemoryStats();
        console.log(`Current memory usage: ${stats.current.heapUsed}MB`);
        console.log(`Memory trend: ${stats.trend}`);
    }

    private async testIntegrationPerformance(): Promise<void> {
        console.log('Testing integration performance...');
        
        const prompt = createTestPrompt('integration-test');
        prompt.template.instructions = 'Review: ${code}\nLanguage: ${language}\nExperience: ${experienceLevel}';

        const variables: VariableMap = {
            code: 'function example() { return "test"; }',
            language: 'javascript',
            experienceLevel: 'intermediate'
        };

        const startTime = performance.now();
        const iterations = 100;

        for (let i = 0; i < iterations; i++) {
            this.cache.set(prompt.id, prompt);
            const cached = this.cache.get(prompt.id);
            if (cached) {
                this.templateEngine.processTemplate(cached, variables);
            }
        }

        const endTime = performance.now();
        const duration = endTime - startTime;
        const operationsPerSecond = iterations / (duration / 1000);

        console.log(`Integration performance: ${operationsPerSecond.toFixed(0)} ops/sec`);
        
        const cacheStats = this.cache.getStats();
        console.log(`Integration cache hit rate: ${cacheStats.hitRate.toFixed(1)}%`);
    }

    private cleanup(): void {
        this.cache.clear();
        this.templateEngine.clearCaches();
        this.memoryMonitor.stopMonitoring();
    }
}

// Export for manual testing
export async function runPerformanceTests(): Promise<void> {
    const tests = new PerformanceTests();
    await tests.runAllTests();
}

// Auto-run if this file is executed directly
if (require.main === module) {
    runPerformanceTests().catch(console.error);
}