import type * as vscode from 'vscode';

// Yona v2 서버의 토큰은 한 종류(범위를 가진 개인 액세스 토큰)뿐이다. 저장 키에 종류 이름이 들어 있어
// 예전에 저장된 토큰이 계속 쓰이도록 이름은 그대로 둔다.
export type TokenKind = 'scoped';

export class TokenStore {
  constructor(private readonly secrets: vscode.SecretStorage) {}

  async getToken(serverUrl: string, kind: TokenKind): Promise<string | undefined> {
    return this.secrets.get(this.keyFor(serverUrl, kind));
  }

  async setToken(serverUrl: string, kind: TokenKind, token: string): Promise<void> {
    await this.secrets.store(this.keyFor(serverUrl, kind), token);
  }

  async deleteToken(serverUrl: string, kind: TokenKind): Promise<void> {
    await this.secrets.delete(this.keyFor(serverUrl, kind));
  }

  private keyFor(serverUrl: string, kind: TokenKind): string {
    return `yona.pat.${kind}.${serverUrl}`;
  }
}
