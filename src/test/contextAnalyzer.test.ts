/**
 * Unit tests for ContextAnalyzer
 */

import * as assert from 'assert';
import { ContextAnalyzer } from '../prompt/ContextAnalyzer';
import { UserAction, CodeContext } from '../prompt/types';

suite('ContextAnalyzer Test Suite', () => {
    let analyzer: ContextAnalyzer;

    setup(() => {
        analyzer = new ContextAnalyzer();
    });

    suite('analyzeContext', () => {
        test('should analyze basic context without errors', () => {
            const context: CodeContext = {
                filePath: '/path/to/file.ts',
                selectedText: 'const x = 1;',
                language: 'typescript'
            };

            const result = analyzer.analyzeContext(UserAction.CODE_REVIEW, context);

            assert.strictEqual(result.action, UserAction.CODE_REVIEW);
            assert.strictEqual(result.language, 'typescript');
            assert.strictEqual(result.hasError, false);
            assert.strictEqual(result.codeSelection, 'const x = 1;');
            assert.strictEqual(result.fileType, 'typescript');
            assert.strictEqual(result.projectContext, undefined);
        });

        test('should analyze context with error message', () => {
            const context: CodeContext = {
                filePath: '/path/to/file.js',
                errorMessage: 'Syntax error: unexpected token',
                language: 'javascript'
            };

            const result = analyzer.analyzeContext(UserAction.DEBUG_ERROR, context);

            assert.strictEqual(result.action, UserAction.DEBUG_ERROR);
            assert.strictEqual(result.language, 'javascript');
            assert.strictEqual(result.hasError, true);
            assert.strictEqual(result.errorType, 'syntax');
            assert.strictEqual(result.codeSelection, undefined);
            assert.strictEqual(result.fileType, 'javascript');
        });

        test('should analyze context with diagnostics', () => {
            const context: CodeContext = {
                filePath: '/path/to/file.py',
                diagnostics: [{
                    source: 'eslint',
                    message: 'Missing semicolon',
                    severity: 1
                }],
                language: 'python'
            };

            const result = analyzer.analyzeContext(UserAction.CODE_REVIEW, context);

            assert.strictEqual(result.action, UserAction.CODE_REVIEW);
            assert.strictEqual(result.language, 'python');
            assert.strictEqual(result.hasError, true);
            assert.strictEqual(result.errorType, 'lint');
        });

        test('should detect test file type', () => {
            const context: CodeContext = {
                filePath: '/path/to/component.test.ts',
                language: 'typescript'
            };

            const result = analyzer.analyzeContext(UserAction.CODE_REVIEW, context);

            assert.strictEqual(result.fileType, 'test');
        });

        test('should detect React framework from file path', () => {
            const context: CodeContext = {
                filePath: '/src/components/Button.tsx',
                language: 'typescript'
            };

            const result = analyzer.analyzeContext(UserAction.CODE_REVIEW, context);

            assert.strictEqual(result.projectContext?.framework, 'react');
        });
    });

    suite('determinePromptType', () => {
        test('should return correct prompt for code review action', () => {
            const context = {
                action: UserAction.CODE_REVIEW,
                language: 'typescript',
                hasError: false,
                fileType: 'source'
            };

            const result = analyzer.determinePromptType(context);

            assert.strictEqual(result, 'code-review');
        });

        test('should prioritize error-specific prompt when error is present', () => {
            const context = {
                action: UserAction.CODE_REVIEW,
                language: 'typescript',
                hasError: true,
                errorType: 'syntax',
                fileType: 'source'
            };

            const result = analyzer.determinePromptType(context);

            assert.strictEqual(result, 'debug-analysis');
        });

        test('should return debug analysis for debug error action', () => {
            const context = {
                action: UserAction.DEBUG_ERROR,
                language: 'javascript',
                hasError: true,
                errorType: 'runtime',
                fileType: 'source'
            };

            const result = analyzer.determinePromptType(context);

            assert.strictEqual(result, 'debug-analysis');
        });

        test('should return security analysis for security error type', () => {
            const context = {
                action: UserAction.CODE_REVIEW,
                language: 'javascript',
                hasError: true,
                errorType: 'security',
                fileType: 'source'
            };

            const result = analyzer.determinePromptType(context);

            assert.strictEqual(result, 'security-analysis');
        });

        test('should return general prompt as fallback', () => {
            const context = {
                action: 'unknown_action' as UserAction,
                language: 'typescript',
                hasError: false,
                fileType: 'source'
            };

            const result = analyzer.determinePromptType(context);

            assert.strictEqual(result, 'general');
        });
    });

    suite('error type classification', () => {
        const testCases = [
            { message: 'Syntax error: unexpected token', expected: 'syntax' },
            { message: 'Parse error at line 5', expected: 'syntax' },
            { message: 'Type error: cannot assign string to number', expected: 'type' },
            { message: 'Cannot resolve module', expected: 'compile' },
            { message: 'Build failed', expected: 'compile' },
            { message: 'Security vulnerability detected', expected: 'security' },
            { message: 'XSS vulnerability found', expected: 'security' },
            { message: 'Performance issue: slow query', expected: 'performance' },
            { message: 'Memory leak detected', expected: 'performance' },
            { message: 'Unknown runtime error', expected: 'runtime' }
        ];

        testCases.forEach(({ message, expected }) => {
            test(`should classify "${message}" as ${expected}`, () => {
                const context: CodeContext = {
                    filePath: '/path/to/file.js',
                    errorMessage: message,
                    language: 'javascript'
                };

                const result = analyzer.analyzeContext(UserAction.DEBUG_ERROR, context);

                assert.strictEqual(result.errorType, expected);
            });
        });
    });

    suite('diagnostic source classification', () => {
        const testCases = [
            { source: 'eslint', expected: 'lint' },
            { source: 'tslint', expected: 'lint' },
            { source: 'typescript', expected: 'type' },
            { source: 'mypy', expected: 'type' },
            { source: 'security-scanner', expected: 'security' },
            { source: 'compiler', expected: 'compile' },
            { source: 'rustc', expected: 'compile' }
        ];

        testCases.forEach(({ source, expected }) => {
            test(`should classify diagnostic source "${source}" as ${expected}`, () => {
                const context: CodeContext = {
                    filePath: '/path/to/file.js',
                    diagnostics: [{
                        source,
                        message: 'Test error',
                        severity: 1
                    }],
                    language: 'javascript'
                };

                const result = analyzer.analyzeContext(UserAction.DEBUG_ERROR, context);

                assert.strictEqual(result.errorType, expected);
            });
        });
    });

    suite('file type detection', () => {
        const testCases = [
            { filePath: '/path/to/component.test.ts', expected: 'test' },
            { filePath: '/path/to/utils.spec.js', expected: 'test' },
            { filePath: '/path/to/config.json', expected: 'config' },
            { filePath: '/path/to/settings.yaml', expected: 'config' },
            { filePath: '/path/to/README.md', expected: 'documentation' },
            { filePath: '/path/to/Dockerfile', expected: 'docker' },
            { filePath: '/path/to/component.ts', expected: 'typescript' }
        ];

        testCases.forEach(({ filePath, expected }) => {
            test(`should detect file type for ${filePath} as ${expected}`, () => {
                const context: CodeContext = {
                    filePath,
                    language: 'typescript'
                };

                const result = analyzer.analyzeContext(UserAction.CODE_REVIEW, context);

                assert.strictEqual(result.fileType, expected);
            });
        });
    });

    suite('project context detection', () => {
        const frameworkTestCases = [
            { 
                filePath: '/src/components/Button.tsx', 
                expectedFramework: 'react' 
            },
            { 
                filePath: '/pages/index.tsx', 
                expectedFramework: 'nextjs' 
            },
            { 
                filePath: '/src/components/Header.vue', 
                expectedFramework: 'vue' 
            },
            { 
                filePath: '/src/app/app.component.ts', 
                expectedFramework: 'angular' 
            },
            { 
                filePath: '/server/api/users.js', 
                expectedFramework: 'express' 
            }
        ];

        frameworkTestCases.forEach(({ filePath, expectedFramework }) => {
            test(`should detect framework ${expectedFramework} from ${filePath}`, () => {
                const context: CodeContext = {
                    filePath,
                    language: 'typescript'
                };

                const result = analyzer.analyzeContext(UserAction.CODE_REVIEW, context);

                assert.strictEqual(result.projectContext?.framework, expectedFramework);
            });
        });

        const projectTypeTestCases = [
            { 
                filePath: '/src/components/Button.test.ts', 
                expectedType: 'test' 
            },
            { 
                filePath: '/server/api/users.js', 
                expectedType: 'backend' 
            },
            { 
                filePath: '/frontend/components/Header.tsx', 
                expectedType: 'frontend' 
            },
            { 
                filePath: '/lib/utils/helpers.ts', 
                expectedType: 'library' 
            }
        ];

        projectTypeTestCases.forEach(({ filePath, expectedType }) => {
            test(`should detect project type ${expectedType} from ${filePath}`, () => {
                const context: CodeContext = {
                    filePath,
                    language: 'typescript'
                };

                const result = analyzer.analyzeContext(UserAction.CODE_REVIEW, context);

                assert.strictEqual(result.projectContext?.projectType, expectedType);
            });
        });
    });

    suite('edge cases', () => {
        test('should handle empty context gracefully', () => {
            const context: CodeContext = {};

            const result = analyzer.analyzeContext(UserAction.CODE_REVIEW, context);

            assert.strictEqual(result.action, UserAction.CODE_REVIEW);
            assert.strictEqual(result.language, 'plaintext');
            assert.strictEqual(result.hasError, false);
            assert.strictEqual(result.codeSelection, undefined);
            assert.strictEqual(result.fileType, 'plaintext');
            assert.strictEqual(result.projectContext, undefined);
        });

        test('should handle context with empty diagnostics array', () => {
            const context: CodeContext = {
                filePath: '/path/to/file.js',
                diagnostics: [],
                language: 'javascript'
            };

            const result = analyzer.analyzeContext(UserAction.CODE_REVIEW, context);

            assert.strictEqual(result.hasError, false);
        });

        test('should handle context with null values', () => {
            const context: CodeContext = {
                filePath: null as any,
                selectedText: null as any,
                errorMessage: null as any,
                language: null as any
            };

            const result = analyzer.analyzeContext(UserAction.CODE_REVIEW, context);

            assert.strictEqual(result.language, 'plaintext');
            assert.strictEqual(result.hasError, false);
        });
    });
});