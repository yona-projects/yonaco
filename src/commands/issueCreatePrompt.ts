import { Prompter } from '../auth/loginFlow';
import { ProjectRegistry } from '../config/projectConfig';

export interface FileLineRef {
  path: string;
  line: number;
}

export interface CreateIssueFromLineResult {
  owner: string;
  name: string;
  title: string;
  body: string;
}

export async function promptCreateIssueFromLine(
  prompter: Prompter,
  projectRegistry: ProjectRegistry,
  fileLine: FileLineRef,
): Promise<CreateIssueFromLineResult | undefined> {
  const projects = projectRegistry.list();
  if (projects.length === 0) {
    return undefined;
  }

  let owner: string;
  let name: string;
  if (projects.length === 1) {
    ({ owner, name } = projects[0]);
  } else {
    const picked = await prompter.askPick(
      projects.map((project) => `${project.owner}/${project.name}`),
      '이슈를 생성할 프로젝트를 선택하세요',
    );
    if (!picked) {
      return undefined;
    }
    [owner, name] = picked.split('/');
  }

  const title = await prompter.askInput({ prompt: '이슈 제목을 입력하세요' });
  if (!title) {
    return undefined;
  }

  return { owner, name, title, body: `${fileLine.path}:${fileLine.line}` };
}
