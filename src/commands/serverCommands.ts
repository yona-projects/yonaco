import * as vscode from 'vscode';
import { ServerRegistry } from '../config/serverConfig';
import { TokenStore } from '../auth/tokenStore';
import { Prompter, promptAddServer, promptLogin } from '../auth/loginFlow';
import { ApiClient } from '../api/client';
import { ApiError } from '../api/apiError';

const vscodePrompter: Prompter = {
  async askInput({ prompt, password }) {
    return vscode.window.showInputBox({ prompt, password: password ?? false });
  },
};

export function registerServerCommands(
  context: vscode.ExtensionContext,
  serverRegistry: ServerRegistry,
  tokenStore: TokenStore,
  prompter: Prompter = vscodePrompter,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('yona.server.add', async () => {
      const url = await promptAddServer(prompter, serverRegistry);
      if (url) {
        void vscode.window.showInformationMessage(`Yona 서버가 등록되었습니다: ${url}`);
      }
    }),

    vscode.commands.registerCommand('yona.auth.login', async () => {
      const ok = await promptLogin(prompter, serverRegistry, tokenStore, 'scoped');
      if (!ok) {
        void vscode.window.showErrorMessage(
          '로그인에 실패했습니다. 먼저 "Yona: 서버 등록"으로 서버를 등록해주세요.',
        );
        return;
      }
      void vscode.window.showInformationMessage('로그인 정보가 저장되었습니다.');
    }),

    vscode.commands.registerCommand('yona.auth.loginLegacy', async () => {
      const ok = await promptLogin(prompter, serverRegistry, tokenStore, 'legacy');
      if (!ok) {
        void vscode.window.showErrorMessage(
          '레거시 전권 토큰 등록에 실패했습니다. 먼저 "Yona: 서버 등록"으로 서버를 등록해주세요.',
        );
        return;
      }
      await vscode.commands.executeCommand('setContext', 'yona.hasLegacyToken', true);
      void vscode.window.showInformationMessage(
        '레거시 전권 토큰이 저장되었습니다. 라인 리뷰 코멘트/온라인 커밋/브랜치 관리 기능에 사용됩니다.',
      );
    }),

    vscode.commands.registerCommand('yona.connectionTest', async () => {
      const serverUrl = serverRegistry.getCurrent();
      const token = serverUrl ? await tokenStore.getToken(serverUrl, 'scoped') : undefined;
      if (!serverUrl || !token) {
        void vscode.window.showErrorMessage(
          '등록된 서버/토큰이 없습니다. "Yona: 서버 등록"과 "Yona: 로그인"을 먼저 실행하세요.',
        );
        return;
      }

      const client = new ApiClient(serverUrl, token);
      try {
        await client.getJSON('/api/v1/user/status');
        void vscode.window.showInformationMessage(`연결 성공: ${serverUrl}`);
      } catch (err) {
        const message = err instanceof ApiError ? `${err.status}: ${err.body}` : String(err);
        void vscode.window.showErrorMessage(`연결 실패: ${message}`);
      }
    }),
  );
}
