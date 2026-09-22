import * as vscode from 'vscode';
import { ServerRegistry } from './config/serverConfig';
import { TokenStore } from './auth/tokenStore';
import { ProjectRegistry } from './config/projectConfig';
import { createScopedApiClient } from './api/clientFactory';
import { registerServerCommands } from './commands/serverCommands';
import { registerIssueCommands, IssuePanelManager } from './commands/issueCommands';
import { registerProjectCommands } from './commands/projectCommands';
import { createServerStatusBarItem } from './tree/serverStatusBar';
import { IssueTreeProvider } from './tree/issueTreeProvider';

export interface YonacoExports {
  serverRegistry: ServerRegistry;
  tokenStore: TokenStore;
  projectRegistry: ProjectRegistry;
  issueTreeProvider: IssueTreeProvider;
  issuePanels: IssuePanelManager;
}

export async function activate(context: vscode.ExtensionContext): Promise<YonacoExports> {
  const serverRegistry = new ServerRegistry(
    () => vscode.workspace.getConfiguration('yona'),
    vscode.ConfigurationTarget.Global,
  );
  const tokenStore = new TokenStore(context.secrets);
  const projectRegistry = new ProjectRegistry(
    () => vscode.workspace.getConfiguration('yona'),
    vscode.ConfigurationTarget.Global,
  );

  const statusBarItem = createServerStatusBarItem(serverRegistry);
  context.subscriptions.push(statusBarItem);

  const getClient = () => createScopedApiClient(serverRegistry, tokenStore);

  const issueTreeProvider = new IssueTreeProvider(getClient, projectRegistry);
  context.subscriptions.push(vscode.window.registerTreeDataProvider('yona.myIssues', issueTreeProvider));
  const issuePanels = registerIssueCommands(context, issueTreeProvider, getClient);
  registerProjectCommands(context, projectRegistry, issueTreeProvider);

  registerServerCommands(context, serverRegistry, tokenStore, statusBarItem, undefined, () =>
    issueTreeProvider.refresh(),
  );

  const currentServer = serverRegistry.getCurrent();
  const hasLegacyToken = currentServer ? await tokenStore.hasLegacyToken(currentServer) : false;
  await vscode.commands.executeCommand('setContext', 'yona.hasLegacyToken', hasLegacyToken);

  return { serverRegistry, tokenStore, projectRegistry, issueTreeProvider, issuePanels };
}

export function deactivate(): void {}
