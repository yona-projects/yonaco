import * as assert from 'assert';
import { promptAddProject } from '../../../src/config/projectPrompt';
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

function fakePrompter(answer: string | undefined): Prompter {
  return { askInput: async () => answer, askPick: async () => undefined };
}

describe('promptAddProject', () => {
  it('"owner/name" 형식 입력을 파싱해 등록하고 ProjectRef를 반환한다', async () => {
    const config = new FakeWorkspaceConfiguration();
    const registry = new ProjectRegistry(() => config as never);

    const ref = await promptAddProject(fakePrompter('yona-org/yona-server'), registry);

    assert.deepStrictEqual(ref, { owner: 'yona-org', name: 'yona-server' });
    assert.deepStrictEqual(registry.list(), [{ owner: 'yona-org', name: 'yona-server' }]);
  });

  it('입력을 취소하면(undefined) 아무것도 등록하지 않는다', async () => {
    const registry = new ProjectRegistry(() => new FakeWorkspaceConfiguration() as never);

    const ref = await promptAddProject(fakePrompter(undefined), registry);

    assert.strictEqual(ref, undefined);
    assert.deepStrictEqual(registry.list(), []);
  });

  it('"/"가 없는 잘못된 형식이면 등록하지 않고 undefined를 반환한다', async () => {
    const registry = new ProjectRegistry(() => new FakeWorkspaceConfiguration() as never);

    const ref = await promptAddProject(fakePrompter('invalid-format'), registry);

    assert.strictEqual(ref, undefined);
    assert.deepStrictEqual(registry.list(), []);
  });
});
