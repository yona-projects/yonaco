import type * as vscode from 'vscode';

const SERVERS_KEY = 'servers';
const CURRENT_SERVER_KEY = 'currentServer';

export class ServerRegistry {
  constructor(private readonly getConfig: () => vscode.WorkspaceConfiguration) {}

  list(): string[] {
    return this.getConfig().get<string[]>(SERVERS_KEY, []);
  }

  async add(url: string): Promise<void> {
    if (this.list().includes(url)) {
      return;
    }
    await this.getConfig().update(SERVERS_KEY, [...this.list(), url]);
  }

  async remove(url: string): Promise<void> {
    await this.getConfig().update(
      SERVERS_KEY,
      this.list().filter((server) => server !== url),
    );
  }

  getCurrent(): string | undefined {
    return this.getConfig().get<string | undefined>(CURRENT_SERVER_KEY, undefined);
  }

  async setCurrent(url: string): Promise<void> {
    await this.getConfig().update(CURRENT_SERVER_KEY, url);
  }
}
