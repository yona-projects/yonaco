import * as vscode from 'vscode';
import { ServerRegistry } from './config/serverConfig';
import { TokenStore } from './auth/tokenStore';
import { registerServerCommands } from './commands/serverCommands';

export interface YonacoExports {
  serverRegistry: ServerRegistry;
  tokenStore: TokenStore;
}

export async function activate(context: vscode.ExtensionContext): Promise<YonacoExports> {
  const serverRegistry = new ServerRegistry(
    () => vscode.workspace.getConfiguration('yona'),
    vscode.ConfigurationTarget.Global,
  );
  const tokenStore = new TokenStore(context.secrets);

  registerServerCommands(context, serverRegistry, tokenStore);

  const currentServer = serverRegistry.getCurrent();
  const hasLegacyToken = currentServer ? await tokenStore.hasLegacyToken(currentServer) : false;
  await vscode.commands.executeCommand('setContext', 'yona.hasLegacyToken', hasLegacyToken);

  return { serverRegistry, tokenStore };
}

export function deactivate(): void {}
