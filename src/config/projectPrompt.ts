import { Prompter } from '../auth/loginFlow';
import { ProjectRef, ProjectRegistry } from './projectConfig';

export async function promptAddProject(
  prompter: Prompter,
  projectRegistry: ProjectRegistry,
): Promise<ProjectRef | undefined> {
  const input = await prompter.askInput({
    prompt: '등록할 프로젝트를 "owner/name" 형식으로 입력하세요 (예: yona-org/yona-server)',
  });
  if (!input) {
    return undefined;
  }

  const [owner, name] = input.split('/');
  if (!owner || !name) {
    return undefined;
  }

  await projectRegistry.add(owner, name);
  return { owner, name };
}
