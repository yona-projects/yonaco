import * as vscode from 'vscode';
import { ServerRegistry } from './config/serverConfig';
import { TokenStore } from './auth/tokenStore';
import { registerServerCommands } from './commands/serverCommands';

export function activate(context: vscode.ExtensionContext): void {
  const serverRegistry = new ServerRegistry(
    () => vscode.workspace.getConfiguration('yona'),
    vscode.ConfigurationTarget.Global,
  );
  const tokenStore = new TokenStore(context.secrets);

  registerServerCommands(context, serverRegistry, tokenStore);
}

export function deactivate(): void {}
