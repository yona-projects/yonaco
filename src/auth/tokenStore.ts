import type * as vscode from 'vscode';

export type TokenKind = 'scoped' | 'legacy';

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
