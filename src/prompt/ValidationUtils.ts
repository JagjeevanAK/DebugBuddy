/**
 * ValidationUtils - Comprehensive validation utilities for prompt templates
 */

import * as fs from 'fs';
import * as path from 'path';
import { JsonPrompt, ValidationResult, PromptTemplate, PromptConfig, PromptCategory } from './types';
import { PromptValidator } from './PromptValidator';
import { PromptLoader } from './PromptLoader';

export interface ValidationReport {
    summary: {
        totalPrompts: number;
        validPrompts: number;
        invalidPrompts: number;
        promptsWithWarnings: number;
        directories: number;
    };
    details: PromptValidationDetail[];
    recommendations: string[];
    criticalIssues: string[];
}

export interface PromptValidationDetail {
    filePath: string;
    promptId?: string;
    promptName?: string;
    isValid: boolean;
    errors: string[];
    warnings: string[];
    metadata: {
        fileSize: number;
        lastModified: Date;
        category?: PromptCategory;
        version?: string;
    };
}

export interface SchemaValidationResult {
    isValid: boolean;
    schemaVersion: string;
    supportedVersions: string[];
    errors: string[];
    warnings: string[];
    migrationRequired: boolean;
    migrationPath?: string;
}

export interface TemplateAnalysis {
    variableUsage: {
        declared: string[];
        used: string[];
        unused: string[];
        undeclared: string[];
    };
    complexity: {
        score: number;
        level: 'low' | 'medium' | 'high';
        factors: string[];
    };
    recommendations: string[];
    potentialIssues: string[];
}

export class ValidationUtils {
    private validator: PromptValidator;
    private loader: PromptLoader;

    constructor() {
        this.validator = new PromptValidator();
        this.loader = new PromptLoader();
    }

    /**
     * Validate all prompts in multiple directories and generate comprehensive report
     */
    async validateDirectories(directories: string[]): Promise<ValidationReport> {
        const report: ValidationReport = {
            summary: {
                totalPrompts: 0,
                validPrompts: 0,
                invalidPrompts: 0,
                promptsWithWarnings: 0,
                directories: directories.length
            },
            details: [],
            recommendations: [],
            criticalIssues: []
        };

        for (const directory of directories) {
            try {
                const directoryDetails = await this.validateDirectory(directory);
                report.details.push(...directoryDetails);
            } catch (error) {
                report.criticalIssues.push(`Failed to validate directory ${directory}: ${error}`);
            }
        }

        // Calculate summary
        report.summary.totalPrompts = report.details.length;
        report.summary.validPrompts = report.details.filter(d => d.isValid).length;
        report.summary.invalidPrompts = report.details.filter(d => !d.isValid).length;
        report.summary.promptsWithWarnings = report.details.filter(d => d.warnings.length > 0).length;

        // Generate recommendations
        report.recommendations = this.generateRecommendations(report.details);

        return report;
    }

    /**
     * Validate all prompts in a single directory
     */
    async validateDirectory(directory: string): Promise<PromptValidationDetail[]> {
        const details: PromptValidationDetail[] = [];

        if (!fs.existsSync(directory)) {
            throw new Error(`Directory does not exist: ${directory}`);
        }

        const files = await this.loader.discoverPromptFiles(directory, true);

        for (const filePath of files) {
            try {
                const detail = await this.validateSingleFile(filePath);
                details.push(detail);
            } catch (error) {
                details.push({
                    filePath,
                    isValid: false,
                    errors: [error instanceof Error ? error.message : 'Unknown error'],
                    warnings: [],
                    metadata: {
                        fileSize: 0,
                        lastModified: new Date()
                    }
                });
            }
        }

        return details;
    }

    /**
     * Validate a single prompt file with detailed analysis
     */
    async validateSingleFile(filePath: string): Promise<PromptValidationDetail> {
        const stats = await fs.promises.stat(filePath);
        
        const detail: PromptValidationDetail = {
            filePath,
            isValid: false,
            errors: [],
            warnings: [],
            metadata: {
                fileSize: stats.size,
                lastModified: stats.mtime
            }
        };

        try {
            // Load and parse the prompt
            const prompt = await this.loader.loadPromptFromFile(filePath);
            detail.promptId = prompt.id;
            detail.promptName = prompt.name;
            detail.metadata.category = prompt.category;
            detail.metadata.version = prompt.version;

            // Validate using comprehensive validator
            const validation = this.validator.validatePrompt(prompt);
            detail.isValid = validation.isValid;
            detail.errors = validation.errors;
            detail.warnings = validation.warnings;

            // Additional custom validations
            const customValidation = await this.performCustomValidations(prompt, filePath);
            detail.errors.push(...customValidation.errors);
            detail.warnings.push(...customValidation.warnings);

            // Update validity based on custom validations
            if (customValidation.errors.length > 0) {
                detail.isValid = false;
            }

        } catch (error) {
            detail.errors.push(error instanceof Error ? error.message : 'Unknown error');
        }

        return detail;
    }

    /**
     * Perform additional custom validations beyond basic schema validation
     */
    private async performCustomValidations(prompt: JsonPrompt, filePath: string): Promise<ValidationResult> {
        const errors: string[] = [];
        const warnings: string[] = [];

        // File naming conventions
        const fileName = path.basename(filePath, '.json');
        if (fileName !== prompt.id) {
            warnings.push(`File name '${fileName}' does not match prompt ID '${prompt.id}'`);
        }

        // Template analysis
        const templateAnalysis = this.analyzeTemplate(prompt.template);
        warnings.push(...templateAnalysis.recommendations);
        errors.push(...templateAnalysis.potentialIssues.filter(issue => issue.includes('critical')));

        // Configuration consistency
        const configValidation = this.validateConfigurationConsistency(prompt);
        errors.push(...configValidation.errors);
        warnings.push(...configValidation.warnings);

        // Version and compatibility checks
        const versionValidation = this.validateVersionCompatibility(prompt);
        warnings.push(...versionValidation.warnings);

        // Security checks
        const securityValidation = this.performSecurityValidation(prompt);
        errors.push(...securityValidation.errors);
        warnings.push(...securityValidation.warnings);

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Analyze template complexity and usage patterns
     */
    analyzeTemplate(template: PromptTemplate): TemplateAnalysis {
        const analysis: TemplateAnalysis = {
            variableUsage: {
                declared: template.variables || [],
                used: [],
                unused: [],
                undeclared: []
            },
            complexity: {
                score: 0,
                level: 'low',
                factors: []
            },
            recommendations: [],
            potentialIssues: []
        };

        // Extract used variables
        const usedVariables = this.extractUsedVariables(template);
        analysis.variableUsage.used = Array.from(usedVariables);

        // Find unused and undeclared variables
        const declaredSet = new Set(analysis.variableUsage.declared);
        const usedSet = new Set(analysis.variableUsage.used);

        analysis.variableUsage.unused = analysis.variableUsage.declared.filter(v => !usedSet.has(v));
        analysis.variableUsage.undeclared = analysis.variableUsage.used.filter(v => !declaredSet.has(v));

        // Calculate complexity
        analysis.complexity.score = this.calculateComplexityScore(template);
        analysis.complexity.level = this.getComplexityLevel(analysis.complexity.score);
        analysis.complexity.factors = this.getComplexityFactors(template);

        // Generate recommendations
        if (analysis.variableUsage.unused.length > 0) {
            analysis.recommendations.push(`Remove unused variables: ${analysis.variableUsage.unused.join(', ')}`);
        }

        if (analysis.variableUsage.undeclared.length > 0) {
            analysis.potentialIssues.push(`Undeclared variables found: ${analysis.variableUsage.undeclared.join(', ')}`);
        }

        if (analysis.complexity.level === 'high') {
            analysis.recommendations.push('Consider simplifying this template to improve maintainability');
        }

        if (template.instructions.length > 2000) {
            analysis.recommendations.push('Template instructions are very long, consider breaking into smaller sections');
        }

        return analysis;
    }

    /**
     * Extract variables used in template content
     */
    private extractUsedVariables(template: PromptTemplate): Set<string> {
        const variables = new Set<string>();
        const variablePattern = /\$\{([^}]+)\}/g;

        // Check all string fields in template
        const checkString = (str: string) => {
            let match;
            while ((match = variablePattern.exec(str)) !== null) {
                const variableName = match[1].trim().split('.')[0]; // Handle nested variables
                variables.add(variableName);
            }
        };

        checkString(template.task);
        checkString(template.instructions);
        
        if (template.language) {
            checkString(template.language);
        }

        // Check context object recursively
        this.extractVariablesFromObject(template.context, variables);

        // Check output format
        if (template.output_format && typeof template.output_format.structure === 'string') {
            checkString(template.output_format.structure);
        }

        return variables;
    }

    /**
     * Recursively extract variables from nested objects
     */
    private extractVariablesFromObject(obj: any, variables: Set<string>): void {
        if (typeof obj === 'string') {
            const variablePattern = /\$\{([^}]+)\}/g;
            let match;
            while ((match = variablePattern.exec(obj)) !== null) {
                const variableName = match[1].trim().split('.')[0];
                variables.add(variableName);
            }
        } else if (Array.isArray(obj)) {
            for (const item of obj) {
                this.extractVariablesFromObject(item, variables);
            }
        } else if (typeof obj === 'object' && obj !== null) {
            for (const value of Object.values(obj)) {
                this.extractVariablesFromObject(value, variables);
            }
        }
    }

    /**
     * Calculate template complexity score
     */
    private calculateComplexityScore(template: PromptTemplate): number {
        let score = 0;

        // Base complexity from instruction length
        score += Math.min(template.instructions.length / 100, 10);

        // Variable complexity
        score += (template.variables?.length || 0) * 0.5;

        // Context complexity
        score += this.getObjectComplexity(template.context) * 2;

        // Output format complexity
        score += this.getObjectComplexity(template.output_format);

        return Math.round(score);
    }

    /**
     * Get complexity level from score
     */
    private getComplexityLevel(score: number): 'low' | 'medium' | 'high' {
        if (score <= 5) {
            return 'low';
        }
        if (score <= 15) {
            return 'medium';
        }
        return 'high';
    }

    /**
     * Get factors contributing to complexity
     */
    private getComplexityFactors(template: PromptTemplate): string[] {
        const factors: string[] = [];

        if (template.instructions.length > 1000) {
            factors.push('Long instructions');
        }

        if ((template.variables?.length || 0) > 10) {
            factors.push('Many variables');
        }

        if (this.getObjectComplexity(template.context) > 3) {
            factors.push('Complex context structure');
        }

        if (this.getObjectComplexity(template.output_format) > 2) {
            factors.push('Complex output format');
        }

        return factors;
    }

    /**
     * Calculate object complexity (depth and breadth)
     */
    private getObjectComplexity(obj: any, depth: number = 0): number {
        if (typeof obj !== 'object' || obj === null) {
            return 0;
        }

        if (depth > 5) {
            return 10; // Penalize very deep nesting
        }

        let complexity = Object.keys(obj).length * 0.5; // Breadth

        for (const value of Object.values(obj)) {
            complexity += this.getObjectComplexity(value, depth + 1) * 0.3; // Depth
        }

        return complexity;
    }

    /**
     * Validate configuration consistency
     */
    private validateConfigurationConsistency(prompt: JsonPrompt): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Check if configurable fields exist in template
        if (prompt.config.configurable_fields) {
            for (const field of prompt.config.configurable_fields) {
                if (!this.fieldExistsInTemplate(field, prompt.template)) {
                    warnings.push(`Configurable field '${field}' not found in template`);
                }
            }
        }

        // Check default values
        if (prompt.config.default_values) {
            for (const [key, value] of Object.entries(prompt.config.default_values)) {
                if (!prompt.config.configurable_fields?.includes(key)) {
                    warnings.push(`Default value for '${key}' but field is not configurable`);
                }

                // Type validation for common fields
                if (key === 'max_suggestions' && typeof value !== 'number') {
                    errors.push(`Default value for 'max_suggestions' must be a number`);
                }
            }
        }

        return { isValid: errors.length === 0, errors, warnings };
    }

    /**
     * Check if field exists in template
     */
    private fieldExistsInTemplate(fieldPath: string, template: PromptTemplate): boolean {
        const parts = fieldPath.split('.');
        let current: any = template;

        for (const part of parts) {
            if (typeof current !== 'object' || current === null || !(part in current)) {
                return false;
            }
            current = current[part];
        }

        return true;
    }

    /**
     * Validate version compatibility
     */
    private validateVersionCompatibility(prompt: JsonPrompt): ValidationResult {
        const warnings: string[] = [];

        // Check schema version
        const supportedVersions = ['1.0', '1.1'];
        if (!supportedVersions.includes(prompt.schema_version)) {
            warnings.push(`Schema version '${prompt.schema_version}' may not be fully supported`);
        }

        // Check prompt version format
        if (prompt.version && !/^\d+\.\d+(\.\d+)?$/.test(prompt.version)) {
            warnings.push('Version should follow semantic versioning format (e.g., 1.0.0)');
        }

        return { isValid: true, errors: [], warnings };
    }

    /**
     * Perform security validation
     */
    private performSecurityValidation(prompt: JsonPrompt): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Check for potential injection patterns
        const dangerousPatterns = [
            /eval\s*\(/i,
            /exec\s*\(/i,
            /system\s*\(/i,
            /<script/i,
            /javascript:/i
        ];

        const checkForDangerousPatterns = (text: string, context: string) => {
            for (const pattern of dangerousPatterns) {
                if (pattern.test(text)) {
                    warnings.push(`Potentially dangerous pattern found in ${context}`);
                }
            }
        };

        checkForDangerousPatterns(prompt.template.instructions, 'instructions');
        checkForDangerousPatterns(prompt.template.task, 'task');

        // Check for overly permissive variable patterns
        if (prompt.template.variables) {
            for (const variable of prompt.template.variables) {
                if (variable.includes('*') || variable.includes('..')) {
                    warnings.push(`Variable '${variable}' uses potentially unsafe patterns`);
                }
            }
        }

        return { isValid: errors.length === 0, errors, warnings };
    }

    /**
     * Generate recommendations based on validation results
     */
    private generateRecommendations(details: PromptValidationDetail[]): string[] {
        const recommendations: string[] = [];
        const issues = new Map<string, number>();

        // Count common issues
        for (const detail of details) {
            for (const error of detail.errors) {
                issues.set(error, (issues.get(error) || 0) + 1);
            }
            for (const warning of detail.warnings) {
                issues.set(warning, (issues.get(warning) || 0) + 1);
            }
        }

        // Generate recommendations for common issues
        for (const [issue, count] of issues) {
            if (count > 1) {
                recommendations.push(`Fix common issue affecting ${count} prompts: ${issue}`);
            }
        }

        // General recommendations
        const invalidCount = details.filter(d => !d.isValid).length;
        if (invalidCount > 0) {
            recommendations.push(`Fix ${invalidCount} invalid prompts before deployment`);
        }

        const warningCount = details.filter(d => d.warnings.length > 0).length;
        if (warningCount > details.length * 0.5) {
            recommendations.push('Consider addressing warnings to improve prompt quality');
        }

        return recommendations;
    }

    /**
     * Validate schema compatibility and suggest migrations
     */
    validateSchemaCompatibility(prompt: JsonPrompt): SchemaValidationResult {
        const supportedVersions = ['1.0', '1.1'];
        const currentVersion = prompt.schema_version;
        
        const result: SchemaValidationResult = {
            isValid: supportedVersions.includes(currentVersion),
            schemaVersion: currentVersion,
            supportedVersions,
            errors: [],
            warnings: [],
            migrationRequired: false
        };

        if (!result.isValid) {
            result.errors.push(`Unsupported schema version: ${currentVersion}`);
            result.migrationRequired = true;
            
            // Suggest migration path
            if (currentVersion < '1.0') {
                result.migrationPath = 'Upgrade to schema version 1.0';
            } else {
                result.migrationPath = `Downgrade to supported version ${supportedVersions[supportedVersions.length - 1]}`;
            }
        }

        return result;
    }

    /**
     * Generate validation report in different formats
     */
    generateReport(report: ValidationReport, format: 'json' | 'markdown' | 'html' = 'json'): string {
        switch (format) {
            case 'markdown':
                return this.generateMarkdownReport(report);
            case 'html':
                return this.generateHtmlReport(report);
            default:
                return JSON.stringify(report, null, 2);
        }
    }

    /**
     * Generate markdown report
     */
    private generateMarkdownReport(report: ValidationReport): string {
        const lines: string[] = [];
        
        lines.push('# Prompt Validation Report');
        lines.push('');
        lines.push('## Summary');
        lines.push(`- Total Prompts: ${report.summary.totalPrompts}`);
        lines.push(`- Valid Prompts: ${report.summary.validPrompts}`);
        lines.push(`- Invalid Prompts: ${report.summary.invalidPrompts}`);
        lines.push(`- Prompts with Warnings: ${report.summary.promptsWithWarnings}`);
        lines.push(`- Directories Scanned: ${report.summary.directories}`);
        lines.push('');

        if (report.criticalIssues.length > 0) {
            lines.push('## Critical Issues');
            for (const issue of report.criticalIssues) {
                lines.push(`- ${issue}`);
            }
            lines.push('');
        }

        if (report.recommendations.length > 0) {
            lines.push('## Recommendations');
            for (const rec of report.recommendations) {
                lines.push(`- ${rec}`);
            }
            lines.push('');
        }

        lines.push('## Detailed Results');
        for (const detail of report.details) {
            lines.push(`### ${detail.promptName || path.basename(detail.filePath)}`);
            lines.push(`- **File**: ${detail.filePath}`);
            lines.push(`- **Status**: ${detail.isValid ? 'Valid' : 'Invalid'}`);
            
            if (detail.errors.length > 0) {
                lines.push('- **Errors**:');
                for (const error of detail.errors) {
                    lines.push(`  - ${error}`);
                }
            }
            
            if (detail.warnings.length > 0) {
                lines.push('- **Warnings**:');
                for (const warning of detail.warnings) {
                    lines.push(`  - ${warning}`);
                }
            }
            
            lines.push('');
        }

        return lines.join('\n');
    }

    /**
     * Generate HTML report
     */
    private generateHtmlReport(report: ValidationReport): string {
        return `
<!DOCTYPE html>
<html>
<head>
    <title>Prompt Validation Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; }
        .valid { color: green; }
        .invalid { color: red; }
        .warning { color: orange; }
        .detail { margin: 10px 0; padding: 10px; border: 1px solid #ddd; border-radius: 3px; }
    </style>
</head>
<body>
    <h1>Prompt Validation Report</h1>
    
    <div class="summary">
        <h2>Summary</h2>
        <ul>
            <li>Total Prompts: ${report.summary.totalPrompts}</li>
            <li>Valid Prompts: <span class="valid">${report.summary.validPrompts}</span></li>
            <li>Invalid Prompts: <span class="invalid">${report.summary.invalidPrompts}</span></li>
            <li>Prompts with Warnings: <span class="warning">${report.summary.promptsWithWarnings}</span></li>
            <li>Directories Scanned: ${report.summary.directories}</li>
        </ul>
    </div>

    ${report.criticalIssues.length > 0 ? `
    <h2>Critical Issues</h2>
    <ul>
        ${report.criticalIssues.map(issue => `<li class="invalid">${issue}</li>`).join('')}
    </ul>
    ` : ''}

    ${report.recommendations.length > 0 ? `
    <h2>Recommendations</h2>
    <ul>
        ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
    </ul>
    ` : ''}

    <h2>Detailed Results</h2>
    ${report.details.map(detail => `
    <div class="detail">
        <h3>${detail.promptName || path.basename(detail.filePath)}</h3>
        <p><strong>File:</strong> ${detail.filePath}</p>
        <p><strong>Status:</strong> <span class="${detail.isValid ? 'valid' : 'invalid'}">${detail.isValid ? 'Valid' : 'Invalid'}</span></p>
        
        ${detail.errors.length > 0 ? `
        <p><strong>Errors:</strong></p>
        <ul>
            ${detail.errors.map(error => `<li class="invalid">${error}</li>`).join('')}
        </ul>
        ` : ''}
        
        ${detail.warnings.length > 0 ? `
        <p><strong>Warnings:</strong></p>
        <ul>
            ${detail.warnings.map(warning => `<li class="warning">${warning}</li>`).join('')}
        </ul>
        ` : ''}
    </div>
    `).join('')}
</body>
</html>
        `.trim();
    }
}