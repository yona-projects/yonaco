import * as assert from 'assert';
import { ProjectRegistry } from '../../../src/config/projectConfig';

class FakeWorkspaceConfiguration {
  private readonly data = new Map<string, unknown>();
  get<T>(key: string, defaultValue?: T): T {
    return (this.data.has(key) ? this.data.get(key) : defaultValue) as T;
  }
  async update(key: string, value: unknown): Promise<void> {
    this.data.set(key, value);
  }
}

describe('ProjectRegistry', () => {
  it('add(owner, name) 후 list()에 {owner, name}이 포함된다', async () => {
    const config = new FakeWorkspaceConfiguration();
    const registry = new ProjectRegistry(() => config as never);

    await registry.add('yona-org', 'yona-server');

    assert.deepStrictEqual(registry.list(), [{ owner: 'yona-org', name: 'yona-server' }]);
  });

  it('같은 owner/name을 두 번 add해도 중복 저장되지 않는다', async () => {
    const config = new FakeWorkspaceConfiguration();
    const registry = new ProjectRegistry(() => config as never);

    await registry.add('yona-org', 'yona-server');
    await registry.add('yona-org', 'yona-server');

    assert.strictEqual(registry.list().length, 1);
  });

  it('remove(owner, name) 후 목록에서 사라진다', async () => {
    const config = new FakeWorkspaceConfiguration();
    const registry = new ProjectRegistry(() => config as never);
    await registry.add('a', 'p1');
    await registry.add('b', 'p2');

    await registry.remove('a', 'p1');

    assert.deepStrictEqual(registry.list(), [{ owner: 'b', name: 'p2' }]);
  });

  it('등록된 프로젝트가 없으면 빈 배열을 반환한다', () => {
    const registry = new ProjectRegistry(() => new FakeWorkspaceConfiguration() as never);
    assert.deepStrictEqual(registry.list(), []);
  });
});
