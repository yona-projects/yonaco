import * as vscode from 'vscode';
import { ServerRegistry } from '../config/serverConfig';
import { issueWebUrl, projectWebUrl } from '../api/webUrls';
import { IssueTreeNode } from '../tree/issueTreeItem';

/**
 * 트리의 프로젝트와 이슈 항목에서 "브라우저에서 열기"를 실행하는 명령을 등록한다.
 * 현재 서버 주소가 없으면 안내만 보인다.
 */
export function registerBrowserCommands(context: vscode.ExtensionContext, serverRegistry: ServerRegistry): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('yona.openInBrowser', async (node?: IssueTreeNode) => {
      const server = serverRegistry.getCurrent();
      if (!server) {
        void vscode.window.showErrorMessage('등록된 서버가 없습니다.');
        return;
      }
      if (!node || node.type === 'empty') {
        return;
      }
      const url =
        node.type === 'issue'
          ? issueWebUrl(server, node.owner, node.name, node.issue.number)
          : projectWebUrl(server, node.owner, node.name);
      await vscode.env.openExternal(vscode.Uri.parse(url));
    }),
  );
}
