import * as vscode from 'vscode';
import { ServerRegistry } from './config/serverConfig';
import { TokenStore } from './auth/tokenStore';
import { createScopedApiClient } from './api/clientFactory';
import { registerServerCommands } from './commands/serverCommands';
import { registerIssueCommands } from './commands/issueCommands';
import { createServerStatusBarItem } from './tree/serverStatusBar';
import { IssueTreeProvider } from './tree/issueTreeProvider';

export interface YonacoExports {
  serverRegistry: ServerRegistry;
  tokenStore: TokenStore;
  issueTreeProvider: IssueTreeProvider;
}

export async function activate(context: vscode.ExtensionContext): Promise<YonacoExports> {
  const serverRegistry = new ServerRegistry(
    () => vscode.workspace.getConfiguration('yona'),
    vscode.ConfigurationTarget.Global,
  );
  const tokenStore = new TokenStore(context.secrets);

  const statusBarItem = createServerStatusBarItem(serverRegistry);
  context.subscriptions.push(statusBarItem);

  const issueTreeProvider = new IssueTreeProvider(() => createScopedApiClient(serverRegistry, tokenStore));
  context.subscriptions.push(vscode.window.registerTreeDataProvider('yona.myIssues', issueTreeProvider));
  registerIssueCommands(context, issueTreeProvider);

  registerServerCommands(context, serverRegistry, tokenStore, statusBarItem, undefined, () =>
    issueTreeProvider.refresh(),
  );

  const currentServer = serverRegistry.getCurrent();
  const hasLegacyToken = currentServer ? await tokenStore.hasLegacyToken(currentServer) : false;
  await vscode.commands.executeCommand('setContext', 'yona.hasLegacyToken', hasLegacyToken);

  return { serverRegistry, tokenStore, issueTreeProvider };
}

export function deactivate(): void {}
