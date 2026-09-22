import * as assert from 'assert';
import { promptCreateIssueFromLine } from '../../../src/commands/issueCreatePrompt';
import { ProjectRegistry } from '../../../src/config/projectConfig';
import { Prompter } from '../../../src/auth/loginFlow';

class FakeWorkspaceConfiguration {
  private readonly data = new Map<string, unknown>();
  get<T>(key: string, defaultValue?: T): T {
    return (this.data.has(key) ? this.data.get(key) : defaultValue) as T;
  }
  async update(key: string, value: unknown): Promise<void> {
    this.data.set(key, value);
  }
}

function fakePrompter(pickAnswer: string | undefined, inputAnswer: string | undefined): Prompter {
  return { askInput: async () => inputAnswer, askPick: async () => pickAnswer };
}

describe('promptCreateIssueFromLine', () => {
  it('등록된 프로젝트가 하나뿐이면 선택창 없이 그 프로젝트로 결정하고, 파일:라인을 본문에 채운다', async () => {
    const config = new FakeWorkspaceConfiguration();
    const registry = new ProjectRegistry(() => config as never);
    await registry.add('owner1', 'proj1');

    const result = await promptCreateIssueFromLine(fakePrompter(undefined, '버그 제목'), registry, {
      path: 'src/foo.ts',
      line: 42,
    });

    assert.deepStrictEqual(result, {
      owner: 'owner1',
      name: 'proj1',
      title: '버그 제목',
      body: 'src/foo.ts:42',
    });
  });

  it('등록된 프로젝트가 여러 개면 선택창을 띄우고, 선택한 프로젝트를 사용한다', async () => {
    const config = new FakeWorkspaceConfiguration();
    const registry = new ProjectRegistry(() => config as never);
    await registry.add('owner1', 'proj1');
    await registry.add('owner2', 'proj2');

    const result = await promptCreateIssueFromLine(fakePrompter('owner2/proj2', '제목'), registry, {
      path: 'a.ts',
      line: 1,
    });

    assert.strictEqual(result?.owner, 'owner2');
    assert.strictEqual(result?.name, 'proj2');
  });

  it('등록된 프로젝트가 없으면 undefined를 반환한다', async () => {
    const registry = new ProjectRegistry(() => new FakeWorkspaceConfiguration() as never);

    const result = await promptCreateIssueFromLine(fakePrompter(undefined, '제목'), registry, {
      path: 'a.ts',
      line: 1,
    });

    assert.strictEqual(result, undefined);
  });

  it('제목 입력을 취소하면(undefined) undefined를 반환한다', async () => {
    const config = new FakeWorkspaceConfiguration();
    const registry = new ProjectRegistry(() => config as never);
    await registry.add('owner1', 'proj1');

    const result = await promptCreateIssueFromLine(fakePrompter(undefined, undefined), registry, {
      path: 'a.ts',
      line: 1,
    });

    assert.strictEqual(result, undefined);
  });
});
