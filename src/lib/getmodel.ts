import { vscode } from "../helper/vscode";

export function getModel() {
    return vscode.workspace.getConfiguration('DebugBuddy').get('model');
}

export function getCustomModel() {
    return vscode.workspace.getConfiguration('DebugBuddy').get('customModel');
}
