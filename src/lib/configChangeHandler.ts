/**
 * Configuration Change Handler
 * 
 * Handles VSCode configuration changes for DebugBuddy settings,
 * specifically monitoring API key changes and updating the cache accordingly.
 */

import { vscode } from "../helper/vscode";
import { apiKeyCache } from "./apiKeyCache";
import { ConfigurationManager } from "../prompt/ConfigurationManager";

interface ConfigChangeHandler {
  onConfigurationChanged(event: vscode.ConfigurationChangeEvent): void;
  onPromptConfigurationChange(callback: (settings: any) => void): vscode.Disposable;
  dispose(): void;
}

class ConfigurationChangeHandler implements ConfigChangeHandler {
  private disposable: vscode.Disposable | undefined;
  private promptConfigListeners: ((settings: any) => void)[] = [];

  /**
   * Initialize the configuration change listener
   */
  public initialize(): void {
    try {
      // Register listener for configuration changes
      this.disposable = vscode.workspace.onDidChangeConfiguration(
        this.onConfigurationChanged.bind(this)
      );
      console.log('DebugBuddy: Configuration change listener initialized successfully');
    } catch (error) {
      console.error('DebugBuddy: Failed to initialize configuration change listener:', error);
      // Don't throw - allow extension to continue without configuration monitoring
    }
  }

  /**
   * Handle configuration change events
   * @param event The configuration change event
   */
  public onConfigurationChanged(event: vscode.ConfigurationChangeEvent): void {
    try {
      if (event.affectsConfiguration('DebugBuddy.apiKey')) {
        try {
          const newApiKey = vscode.workspace.getConfiguration('DebugBuddy').get<string>('apiKey');
          
          // Update the cache with the new value
          apiKeyCache.set(newApiKey);
          
          console.log('DebugBuddy: API key configuration changed, cache updated');
        } catch (cacheError) {
          // Log cache update error but don't crash
          console.error('DebugBuddy: Error updating cache after configuration change:', cacheError);
          console.log('DebugBuddy: Cache update failed, but configuration change was detected');
        }
      }

      if (event.affectsConfiguration('DebugBuddy.prompts')) {
        try {
          const configManager = ConfigurationManager.getInstance();
          const validationResult = configManager.validateConfiguration();
          
          if (!validationResult.isValid) {
            console.warn('DebugBuddy: Invalid prompt configuration detected:', validationResult.errors);
            
            // Show detailed error message with option to reset
            vscode.window.showErrorMessage(
              `DebugBuddy: Invalid prompt configuration detected. ${validationResult.errors.join(', ')}`,
              'Reset to Defaults',
              'Ignore'
            ).then(async (selection) => {
              if (selection === 'Reset to Defaults') {
                await configManager.resetToDefaults();
                vscode.window.showInformationMessage('DebugBuddy: Prompt configuration reset to defaults');
              }
            });
          }
          
          if (validationResult.warnings.length > 0) {
            console.warn('DebugBuddy: Prompt configuration warnings:', validationResult.warnings);
            
            // Show warnings as information message
            vscode.window.showWarningMessage(
              `DebugBuddy: Configuration warnings: ${validationResult.warnings.join(', ')}`
            );
          }
          
          // Notify other components about configuration changes
          this.notifyPromptConfigurationChange(configManager.getGlobalSettings());
          
          console.log('DebugBuddy: Prompt configuration changed and validated');
        } catch (promptError) {
          console.error('DebugBuddy: Error handling prompt configuration change:', promptError);
          vscode.window.showErrorMessage(
            `DebugBuddy: Error processing configuration change: ${promptError instanceof Error ? promptError.message : 'Unknown error'}`
          );
        }
      }
    } catch (error) {
      // Log errors but don't crash the extension
      console.error('DebugBuddy: Error handling configuration change:', error);
    }
  }

  /**
   * Register a listener for prompt configuration changes
   * @param callback Function to call when prompt configuration changes
   * @returns Disposable to unregister the listener
   */
  public onPromptConfigurationChange(callback: (settings: any) => void): vscode.Disposable {
    this.promptConfigListeners.push(callback);
    
    return new vscode.Disposable(() => {
      const index = this.promptConfigListeners.indexOf(callback);
      if (index > -1) {
        this.promptConfigListeners.splice(index, 1);
      }
    });
  }

  /**
   * Notify all prompt configuration listeners
   * @param settings The new prompt settings
   */
  private notifyPromptConfigurationChange(settings: any): void {
    this.promptConfigListeners.forEach(listener => {
      try {
        listener(settings);
      } catch (error) {
        console.error('DebugBuddy: Error in prompt configuration change listener:', error);
      }
    });
  }

  /**
   * Dispose of the configuration change listener
   */
  public dispose(): void {
    try {
      if (this.disposable) {
        this.disposable.dispose();
        this.disposable = undefined;
        console.log('DebugBuddy: Configuration change listener disposed successfully');
      }
      
      // Clear all prompt configuration listeners
      this.promptConfigListeners = [];
    } catch (error) {
      console.error('DebugBuddy: Error disposing configuration change listener:', error);
      // Still set to undefined to prevent memory leaks
      this.disposable = undefined;
      this.promptConfigListeners = [];
    }
  }
}

// Export singleton instance
export const configChangeHandler = new ConfigurationChangeHandler();