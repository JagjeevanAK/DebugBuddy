import * as vscode from 'vscode';
import { apiKeyCache } from "./apiKeyCache";

interface ConfigChangeHandler {
  onConfigurationChanged(event: vscode.ConfigurationChangeEvent): void;
  dispose(): void;
}

class ConfigurationChangeHandler implements ConfigChangeHandler {
  private disposable: vscode.Disposable | undefined;

  public initialize(): void {
    try {
      this.disposable = vscode.workspace.onDidChangeConfiguration(
        this.onConfigurationChanged.bind(this)
      );
      console.log('DebugBuddy: Configuration change listener initialized successfully');
    } catch (error) {
      console.error('DebugBuddy: Failed to initialize configuration change listener:', error);
    }
  }

  public onConfigurationChanged(event: vscode.ConfigurationChangeEvent): void {
    try {
      if (event.affectsConfiguration('DebugBuddy.apiKey')) {
        try {
          const newApiKey = vscode.workspace.getConfiguration('DebugBuddy').get<string>('apiKey');
          apiKeyCache.set(newApiKey);
          console.log('DebugBuddy: API key configuration changed, cache updated');
        } catch (cacheError) {
          console.error('DebugBuddy: Error updating cache after configuration change:', cacheError);
          console.log('DebugBuddy: Cache update failed, but configuration change was detected');
        }
      }
    } catch (error) {
      console.error('DebugBuddy: Error handling configuration change:', error);
    }
  }

  public dispose(): void {
    try {
      if (this.disposable) {
        this.disposable.dispose();
        this.disposable = undefined;
        console.log('DebugBuddy: Configuration change listener disposed successfully');
      }
    } catch (error) {
      console.error('DebugBuddy: Error disposing configuration change listener:', error);
      this.disposable = undefined;
    }
  }
}

export const configChangeHandler = new ConfigurationChangeHandler();