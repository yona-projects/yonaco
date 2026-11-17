import * as vscode from 'vscode';
import { ServerRegistry } from '../config/serverConfig';
import { TokenStore } from '../auth/tokenStore';
import { Prompter, promptAddServer, promptLogin, promptSwitchServer } from '../auth/loginFlow';
import { ApiError } from '../api/apiError';
import { createScopedApiClient } from '../api/clientFactory';
import { refreshServerStatusBarItem } from '../tree/serverStatusBar';

export const vscodePrompter: Prompter = {
  async askInput({ prompt, password, validate }) {
    return vscode.window.showInputBox({
      prompt,
      password: password ?? false,
      validateInput: validate,
      ignoreFocusOut: true,
    });
  },
  async askPick(items, placeHolder) {
    return vscode.window.showQuickPick(items, { placeHolder });
  },
};

export function registerServerCommands(
  context: vscode.ExtensionContext,
  serverRegistry: ServerRegistry,
  tokenStore: TokenStore,
  statusBarItem: vscode.StatusBarItem,
  prompter: Prompter = vscodePrompter,
  onAuthOrServerChange?: () => void,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('yona.server.add', async () => {
      const url = await promptAddServer(prompter, serverRegistry);
      refreshServerStatusBarItem(statusBarItem, serverRegistry);
      onAuthOrServerChange?.();
      if (url) {
        void vscode.window.showInformationMessage(`Yona 서버가 등록되었습니다: ${url}`);
      }
    }),

    vscode.commands.registerCommand('yona.server.switch', async () => {
      const picked = await promptSwitchServer(prompter, serverRegistry);
      refreshServerStatusBarItem(statusBarItem, serverRegistry);
      onAuthOrServerChange?.();
      if (!picked) {
        return;
      }
      void vscode.window.showInformationMessage(`Yona 서버 전환: ${picked}`);
    }),

    vscode.commands.registerCommand('yona.auth.login', async () => {
      // 서버가 없을 때만 오류이다. 토큰 입력을 취소하거나 비운 경우는 사용자가 그만둔 것이므로 조용히 끝낸다.
      if (!serverRegistry.getCurrent()) {
        void vscode.window.showErrorMessage(
          '로그인에 실패했습니다. 먼저 "Yona: 서버 등록"으로 서버를 등록해주세요.',
        );
        return;
      }
      const ok = await promptLogin(prompter, serverRegistry, tokenStore, 'scoped');
      if (!ok) {
        return;
      }
      onAuthOrServerChange?.();
      void vscode.window.showInformationMessage('로그인 정보가 저장되었습니다.');
    }),

    vscode.commands.registerCommand('yona.connectionTest', async () => {
      const client = await createScopedApiClient(serverRegistry, tokenStore);
      if (!client) {
        void vscode.window.showErrorMessage(
          '등록된 서버/토큰이 없습니다. "Yona: 서버 등록"과 "Yona: 로그인"을 먼저 실행하세요.',
        );
        return;
      }

      try {
        await client.getJSON('/-_-api/v1/user');
        void vscode.window.showInformationMessage(`연결 성공: ${serverRegistry.getCurrent()}`);
      } catch (err) {
        const message = err instanceof ApiError ? `${err.status}: ${err.body}` : String(err);
        void vscode.window.showErrorMessage(`연결 실패: ${message}`);
      }
    }),
  );
}
