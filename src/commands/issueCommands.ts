import * as vscode from 'vscode';
import { ApiClient } from '../api/client';
import { IssueTreeProvider } from '../tree/issueTreeProvider';
import { IssueNode } from '../tree/issueTreeItem';
import { IssueDetailPanel } from '../webview/issueDetailPanel';

export interface IssuePanelManager {
  getPanel(owner: string, name: string, issueNumber: number): IssueDetailPanel | undefined;
}

function panelKey(owner: string, name: string, issueNumber: number): string {
  return `${owner}/${name}/${issueNumber}`;
}

export function registerIssueCommands(
  context: vscode.ExtensionContext,
  issueTreeProvider: IssueTreeProvider,
  getClient: () => Promise<ApiClient | undefined>,
): IssuePanelManager {
  const panels = new Map<string, IssueDetailPanel>();

  context.subscriptions.push(
    vscode.commands.registerCommand('yona.myIssues.refresh', () => {
      issueTreeProvider.refresh();
    }),

    vscode.commands.registerCommand('yona.issue.open', async (node: IssueNode) => {
      const client = await getClient();
      if (!client) {
        void vscode.window.showErrorMessage('등록된 서버/토큰이 없습니다.');
        return;
      }

      const key = panelKey(node.owner, node.name, node.issue.number);
      const existing = panels.get(key);
      if (existing) {
        existing.reveal();
        return;
      }

      const panel = new IssueDetailPanel(client, node.owner, node.name, node.issue, () =>
        issueTreeProvider.refresh(),
      );
      panels.set(key, panel);
      panel.onDidDispose(() => panels.delete(key));
    }),
  );

  return {
    getPanel: (owner, name, issueNumber) => panels.get(panelKey(owner, name, issueNumber)),
  };
}
