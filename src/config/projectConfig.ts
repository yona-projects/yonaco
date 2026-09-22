import type * as vscode from 'vscode';

const PROJECTS_KEY = 'projects';

export interface ProjectRef {
  owner: string;
  name: string;
}

function toKey(ref: ProjectRef): string {
  return `${ref.owner}/${ref.name}`;
}

export class ProjectRegistry {
  constructor(
    private readonly getConfig: () => vscode.WorkspaceConfiguration,
    private readonly target?: vscode.ConfigurationTarget,
  ) {}

  list(): ProjectRef[] {
    return this.getConfig()
      .get<string[]>(PROJECTS_KEY, [])
      .map((entry) => {
        const [owner, name] = entry.split('/');
        return { owner, name };
      });
  }

  async add(owner: string, name: string): Promise<void> {
    const entries = this.getConfig().get<string[]>(PROJECTS_KEY, []);
    const key = toKey({ owner, name });
    if (entries.includes(key)) {
      return;
    }
    await this.getConfig().update(PROJECTS_KEY, [...entries, key], this.target);
  }

  async remove(owner: string, name: string): Promise<void> {
    const key = toKey({ owner, name });
    const entries = this.getConfig().get<string[]>(PROJECTS_KEY, []);
    await this.getConfig().update(
      PROJECTS_KEY,
      entries.filter((entry) => entry !== key),
      this.target,
    );
  }
}
