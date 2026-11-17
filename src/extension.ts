import * as vscode from 'vscode';
import { ServerRegistry } from './config/serverConfig';
import { TokenStore } from './auth/tokenStore';
import { ProjectRegistry } from './config/projectConfig';
import { createScopedApiClient } from './api/clientFactory';
import { registerServerCommands } from './commands/serverCommands';
import { registerIssueCommands, IssuePanelManager } from './commands/issueCommands';
import { registerProjectCommands } from './commands/projectCommands';
import { registerBrowserCommands } from './commands/browserCommands';
import { registerCommitMessageProviders } from './scm/commitMessageProvider';
import { createServerStatusBarItem } from './tree/serverStatusBar';
import { IssueTreeProvider } from './tree/issueTreeProvider';
import { describeSetupState } from './ui/setupState';
import { applySetupContexts } from './ui/setupContext';

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
  const issuePanels = registerIssueCommands(context, issueTreeProvider, getClient, projectRegistry);
  registerProjectCommands(context, projectRegistry, issueTreeProvider, getClient);
  registerBrowserCommands(context, serverRegistry);
  registerCommitMessageProviders(context, getClient, projectRegistry);

  // 사이드바의 안내 버튼(서버 등록, 로그인, 프로젝트 등록)은 현재 설정 현황에 따라 보이므로,
  // 설정이나 토큰이 바뀔 때마다 컨텍스트 키를 다시 구한다.
  const refreshSetupContexts = async () => {
    const currentServer = serverRegistry.getCurrent();
    const hasToken = currentServer ? (await tokenStore.getToken(currentServer, 'scoped')) !== undefined : false;
    await applySetupContexts(
      describeSetupState({ currentServer, hasToken, projectCount: projectRegistry.list().length }),
    );
  };
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('yona')) {
        void refreshSetupContexts();
      }
    }),
    context.secrets.onDidChange(() => void refreshSetupContexts()),
  );

  registerServerCommands(context, serverRegistry, tokenStore, statusBarItem, undefined, () => {
    issueTreeProvider.refresh();
    void refreshSetupContexts();
  });
  await refreshSetupContexts();

  return { serverRegistry, tokenStore, projectRegistry, issueTreeProvider, issuePanels };
}

export function deactivate(): void {}
