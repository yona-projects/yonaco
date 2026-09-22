import * as vscode from 'vscode';
import { ApiClient } from '../api/client';
import { createIssue, getIssue } from '../api/issueApi';
import { ApiError } from '../api/apiError';
import { ProjectRegistry } from '../config/projectConfig';
import { Prompter } from '../auth/loginFlow';
import { promptCreateIssueFromLine } from './issueCreatePrompt';
import { vscodePrompter } from './serverCommands';
import { IssueTreeProvider } from '../tree/issueTreeProvider';
import { IssueNode } from '../tree/issueTreeItem';
import { Issue } from '../api/types';
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
  projectRegistry: ProjectRegistry,
  prompter: Prompter = vscodePrompter,
): IssuePanelManager {
  const panels = new Map<string, IssueDetailPanel>();

  function openIssuePanel(client: ApiClient, owner: string, name: string, issue: Issue): void {
    const key = panelKey(owner, name, issue.number);
    const existing = panels.get(key);
    if (existing) {
      existing.reveal();
      return;
    }

    const panel = new IssueDetailPanel(client, owner, name, issue, () => issueTreeProvider.refresh());
    panels.set(key, panel);
    panel.onDidDispose(() => panels.delete(key));
  }

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
      openIssuePanel(client, node.owner, node.name, node.issue);
    }),

    vscode.commands.registerCommand('yona.issue.openByNumber', async (issueNumber: number) => {
      const client = await getClient();
      if (!client) {
        void vscode.window.showErrorMessage('등록된 서버/토큰이 없습니다.');
        return;
      }

      for (const project of projectRegistry.list()) {
        try {
          const issue = await getIssue(client, project.owner, project.name, issueNumber);
          openIssuePanel(client, project.owner, project.name, issue);
          return;
        } catch (err) {
          if (!(err instanceof ApiError && err.status === 404)) {
            throw err;
          }
        }
      }

      void vscode.window.showErrorMessage(`등록된 프로젝트에서 #${issueNumber} 이슈를 찾을 수 없습니다.`);
    }),

    vscode.commands.registerCommand('yona.issue.createFromLine', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        void vscode.window.showErrorMessage('활성화된 편집기가 없습니다.');
        return;
      }

      const client = await getClient();
      if (!client) {
        void vscode.window.showErrorMessage('등록된 서버/토큰이 없습니다.');
        return;
      }

      const fileLine = {
        path: vscode.workspace.asRelativePath(editor.document.uri),
        line: editor.selection.active.line + 1,
      };

      const result = await promptCreateIssueFromLine(prompter, projectRegistry, fileLine);
      if (!result) {
        void vscode.window.showErrorMessage(
          '이슈 생성에 실패했습니다. 먼저 "Yona: 프로젝트 등록"으로 프로젝트를 등록해주세요.',
        );
        return;
      }

      const issue = await createIssue(client, result.owner, result.name, result.title, result.body);
      issueTreeProvider.refresh();
      void vscode.window.showInformationMessage(`이슈가 생성되었습니다: #${issue.number} ${issue.title}`);
    }),
  );

  return {
    getPanel: (owner, name, issueNumber) => panels.get(panelKey(owner, name, issueNumber)),
  };
}
