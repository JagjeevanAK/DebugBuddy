import * as vscode from 'vscode';

export interface GlobalPromptSettings {
    experienceLevel: 'beginner' | 'intermediate' | 'advanced';
    maxSuggestions: number;
    includeExplanations: boolean;
    customFocusAreas: string[];
    outputVerbosity: 'minimal' | 'standard' | 'detailed';
    enablePromptSystem: boolean;
    promptDirectory: string;
    cachePrompts: boolean;
}

export interface PromptConfig {
    enabled: boolean;
    priority: number;
    customSettings: Record<string, any>;
    overrides: Record<string, any>;
}

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

export interface IConfigurationManager {
    getPromptConfig(promptId: string): PromptConfig;
    updatePromptConfig(promptId: string, config: Partial<PromptConfig>): Promise<void>;
    getGlobalSettings(): GlobalPromptSettings;
    updateGlobalSettings(settings: Partial<GlobalPromptSettings>): Promise<void>;
    onConfigurationChange(callback: (config: any) => void): vscode.Disposable;
    validateConfiguration(): ValidationResult;
    resetToDefaults(): Promise<void>;
}

export class ConfigurationManager implements IConfigurationManager {
    private static instance: ConfigurationManager;
    private readonly configSection = 'DebugBuddy';
    private changeListeners: ((config: any) => void)[] = [];
    private disposables: vscode.Disposable[] = [];

    private constructor() {
        // Listen for configuration changes
        const configChangeDisposable = vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration(this.configSection)) {
                this.notifyConfigurationChange();
            }
        });
        this.disposables.push(configChangeDisposable);
    }

    public static getInstance(): ConfigurationManager {
        if (!ConfigurationManager.instance) {
            ConfigurationManager.instance = new ConfigurationManager();
        }
        return ConfigurationManager.instance;
    }

    public getPromptConfig(promptId: string): PromptConfig {
        const config = vscode.workspace.getConfiguration(this.configSection);
        const promptConfigs = config.get<Record<string, PromptConfig>>('prompts.configs', {});
        
        return promptConfigs[promptId] || this.getDefaultPromptConfig();
    }

    public async updatePromptConfig(promptId: string, config: Partial<PromptConfig>): Promise<void> {
        const workspaceConfig = vscode.workspace.getConfiguration(this.configSection);
        const currentConfigs = workspaceConfig.get<Record<string, PromptConfig>>('prompts.configs', {});
        
        currentConfigs[promptId] = {
            ...this.getDefaultPromptConfig(),
            ...currentConfigs[promptId],
            ...config
        };

        await workspaceConfig.update('prompts.configs', currentConfigs, vscode.ConfigurationTarget.Workspace);
    }

    public getGlobalSettings(): GlobalPromptSettings {
        const config = vscode.workspace.getConfiguration(this.configSection);
        
        return {
            experienceLevel: config.get<'beginner' | 'intermediate' | 'advanced'>('prompts.experienceLevel', 'intermediate'),
            maxSuggestions: config.get<number>('prompts.maxSuggestions', 5),
            includeExplanations: config.get<boolean>('prompts.includeExplanations', true),
            customFocusAreas: config.get<string[]>('prompts.customFocusAreas', []),
            outputVerbosity: config.get<'minimal' | 'standard' | 'detailed'>('prompts.outputVerbosity', 'standard'),
            enablePromptSystem: config.get<boolean>('prompts.enablePromptSystem', true),
            promptDirectory: config.get<string>('prompts.directory', ''),
            cachePrompts: config.get<boolean>('prompts.cachePrompts', true)
        };
    }

    public async updateGlobalSettings(settings: Partial<GlobalPromptSettings>): Promise<void> {
        const config = vscode.workspace.getConfiguration(this.configSection);
        
        for (const [key, value] of Object.entries(settings)) {
            const configKey = `prompts.${key}`;
            await config.update(configKey, value, vscode.ConfigurationTarget.Global);
        }
    }

    public onConfigurationChange(callback: (config: any) => void): vscode.Disposable {
        this.changeListeners.push(callback);
        
        return new vscode.Disposable(() => {
            const index = this.changeListeners.indexOf(callback);
            if (index > -1) {
                this.changeListeners.splice(index, 1);
            }
        });
    }

    public validateConfiguration(): ValidationResult {
        const result: ValidationResult = {
            isValid: true,
            errors: [],
            warnings: []
        };

        try {
            const settings = this.getGlobalSettings();

            const validExperienceLevels = ['beginner', 'intermediate', 'advanced'];
            if (!validExperienceLevels.includes(settings.experienceLevel)) {
                result.errors.push(`Invalid experience level: ${settings.experienceLevel}. Must be one of: ${validExperienceLevels.join(', ')}`);
                result.isValid = false;
            }

            if (!Number.isInteger(settings.maxSuggestions) || settings.maxSuggestions < 1 || settings.maxSuggestions > 20) {
                result.errors.push(`Max suggestions must be an integer between 1 and 20, got: ${settings.maxSuggestions}`);
                result.isValid = false;
            }

            const validVerbosityLevels = ['minimal', 'standard', 'detailed'];
            if (!validVerbosityLevels.includes(settings.outputVerbosity)) {
                result.errors.push(`Invalid output verbosity: ${settings.outputVerbosity}. Must be one of: ${validVerbosityLevels.join(', ')}`);
                result.isValid = false;
            }

            if (!Array.isArray(settings.customFocusAreas)) {
                result.errors.push('Custom focus areas must be an array');
                result.isValid = false;
            } else if (settings.customFocusAreas.some(area => typeof area !== 'string' || area.trim() === '')) {
                result.warnings.push('Some custom focus areas are empty or invalid');
            }

            if (settings.promptDirectory && typeof settings.promptDirectory !== 'string') {
                result.errors.push('Prompt directory must be a string');
                result.isValid = false;
            } else if (settings.promptDirectory && !settings.promptDirectory.trim()) {
                result.warnings.push('Prompt directory is specified but empty');
            }

            if (typeof settings.includeExplanations !== 'boolean') {
                result.errors.push('Include explanations must be a boolean value');
                result.isValid = false;
            }

            if (typeof settings.enablePromptSystem !== 'boolean') {
                result.errors.push('Enable prompt system must be a boolean value');
                result.isValid = false;
            }

            if (typeof settings.cachePrompts !== 'boolean') {
                result.errors.push('Cache prompts must be a boolean value');
                result.isValid = false;
            }

            const config = vscode.workspace.getConfiguration(this.configSection);
            const promptConfigs = config.get<Record<string, PromptConfig>>('prompts.configs', {});
            
            for (const [promptId, promptConfig] of Object.entries(promptConfigs)) {
                const promptValidation = this.validatePromptConfig(promptId, promptConfig);
                result.errors.push(...promptValidation.errors);
                result.warnings.push(...promptValidation.warnings);
                if (!promptValidation.isValid) {
                    result.isValid = false;
                }
            }

        } catch (error) {
            result.errors.push(`Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            result.isValid = false;
        }

        return result;
    }

    private validatePromptConfig(promptId: string, config: PromptConfig): ValidationResult {
        const result: ValidationResult = {
            isValid: true,
            errors: [],
            warnings: []
        };

        if (typeof config.enabled !== 'boolean') {
            result.errors.push(`Prompt ${promptId}: enabled must be a boolean`);
            result.isValid = false;
        }

        if (!Number.isInteger(config.priority) || config.priority < 0) {
            result.errors.push(`Prompt ${promptId}: priority must be a non-negative integer`);
            result.isValid = false;
        }

        if (typeof config.customSettings !== 'object' || config.customSettings === null) {
            result.errors.push(`Prompt ${promptId}: customSettings must be an object`);
            result.isValid = false;
        }

        if (typeof config.overrides !== 'object' || config.overrides === null) {
            result.errors.push(`Prompt ${promptId}: overrides must be an object`);
            result.isValid = false;
        }

        return result;
    }

    public async resetToDefaults(): Promise<void> {
        const config = vscode.workspace.getConfiguration(this.configSection);
        const defaultSettings: GlobalPromptSettings = {
            experienceLevel: 'intermediate',
            maxSuggestions: 5,
            includeExplanations: true,
            customFocusAreas: [],
            outputVerbosity: 'standard',
            enablePromptSystem: true,
            promptDirectory: '',
            cachePrompts: true
        };

        for (const [key, value] of Object.entries(defaultSettings)) {
            const configKey = `prompts.${key}`;
            await config.update(configKey, value, vscode.ConfigurationTarget.Global);
        }

        // Reset prompt configs
        await config.update('prompts.configs', {}, vscode.ConfigurationTarget.Workspace);
    }

    private getDefaultPromptConfig(): PromptConfig {
        return {
            enabled: true,
            priority: 1,
            customSettings: {},
            overrides: {}
        };
    }

    private notifyConfigurationChange(): void {
        const currentConfig = this.getGlobalSettings();
        this.changeListeners.forEach(listener => {
            try {
                listener(currentConfig);
            } catch (error) {
                console.error('Error in configuration change listener:', error);
            }
        });
    }

    public async migrateConfiguration(): Promise<void> {
        const config = vscode.workspace.getConfiguration(this.configSection);
        
        const hasPromptSettings = config.has('prompts.experienceLevel');
        const currentVersion = config.get<string>('prompts.configVersion', '0.0.0');
        const targetVersion = '1.0.0';
        
        if (!hasPromptSettings) {
            await this.initializeDefaultConfiguration();
            console.log('DebugBuddy: Initialized prompt configuration with default values');
        } else if (currentVersion !== targetVersion) {
            await this.performConfigurationMigration(currentVersion, targetVersion);
            console.log(`DebugBuddy: Migrated configuration from ${currentVersion} to ${targetVersion}`);
        }
        
        // Always validate configuration after migration
        const validationResult = this.validateConfiguration();
        if (!validationResult.isValid) {
            console.warn('DebugBuddy: Configuration validation failed after migration:', validationResult.errors);
            
            // Show user notification about invalid configuration
            vscode.window.showWarningMessage(
                'DebugBuddy: Configuration validation failed after migration. Some settings may have been reset to defaults.',
                'Show Details'
            ).then(selection => {
                if (selection === 'Show Details') {
                    vscode.window.showErrorMessage(
                        `Configuration errors: ${validationResult.errors.join(', ')}`,
                        { modal: true }
                    );
                }
            });
        }
    }

    private async initializeDefaultConfiguration(): Promise<void> {
        const config = vscode.workspace.getConfiguration(this.configSection);
        const defaultSettings: GlobalPromptSettings & { configVersion: string } = {
            experienceLevel: 'intermediate',
            maxSuggestions: 5,
            includeExplanations: true,
            customFocusAreas: [],
            outputVerbosity: 'standard',
            enablePromptSystem: true,
            promptDirectory: '',
            cachePrompts: true,
            configVersion: '1.0.0'
        };

        for (const [key, value] of Object.entries(defaultSettings)) {
            const configKey = key === 'configVersion' ? `prompts.${key}` : `prompts.${key}`;
            if (!config.has(configKey)) {
                await config.update(configKey, value, vscode.ConfigurationTarget.Global);
            }
        }
    }

    private async performConfigurationMigration(fromVersion: string, toVersion: string): Promise<void> {
        const config = vscode.workspace.getConfiguration(this.configSection);
        
        // Migration logic based on version
        if (fromVersion === '0.0.0' && toVersion === '1.0.0') {
            // Migrate from legacy configuration structure
            await this.migrateLegacyConfiguration();
        }
        
        // Update configuration version
        await config.update('prompts.configVersion', toVersion, vscode.ConfigurationTarget.Global);
    }

    private async migrateLegacyConfiguration(): Promise<void> {
        const config = vscode.workspace.getConfiguration(this.configSection);
        
        const legacyMappings: Record<string, string> = {
            'prompt.experienceLevel': 'prompts.experienceLevel',
            'prompt.maxSuggestions': 'prompts.maxSuggestions',
            'prompt.includeExplanations': 'prompts.includeExplanations',
            'prompt.customFocusAreas': 'prompts.customFocusAreas',
            'prompt.outputVerbosity': 'prompts.outputVerbosity'
        };

        for (const [legacyKey, newKey] of Object.entries(legacyMappings)) {
            if (config.has(legacyKey)) {
                const value = config.get(legacyKey);
                await config.update(newKey, value, vscode.ConfigurationTarget.Global);
                await config.update(legacyKey, undefined, vscode.ConfigurationTarget.Global);
                console.log(`DebugBuddy: Migrated ${legacyKey} to ${newKey}`);
            }
        }
    }

    public getConfigurationSummary(): string {
        const settings = this.getGlobalSettings();
        const validation = this.validateConfiguration();
        
        const summary = [
            `Experience Level: ${settings.experienceLevel}`,
            `Max Suggestions: ${settings.maxSuggestions}`,
            `Include Explanations: ${settings.includeExplanations}`,
            `Output Verbosity: ${settings.outputVerbosity}`,
            `Prompt System Enabled: ${settings.enablePromptSystem}`,
            `Cache Prompts: ${settings.cachePrompts}`,
            `Custom Focus Areas: ${settings.customFocusAreas.length > 0 ? settings.customFocusAreas.join(', ') : 'None'}`,
            `Custom Prompt Directory: ${settings.promptDirectory || 'Default'}`,
            `Configuration Status: ${validation.isValid ? 'Valid' : 'Invalid'}`,
        ];

        if (validation.errors.length > 0) {
            summary.push(`Errors: ${validation.errors.join(', ')}`);
        }

        if (validation.warnings.length > 0) {
            summary.push(`Warnings: ${validation.warnings.join(', ')}`);
        }

        return summary.join('\n');
    }

    public dispose(): void {
        this.disposables.forEach(disposable => disposable.dispose());
        this.changeListeners = [];
    }
}