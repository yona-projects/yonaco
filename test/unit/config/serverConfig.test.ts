import * as assert from 'assert';
import { ServerRegistry } from '../../../src/config/serverConfig';

class FakeWorkspaceConfiguration {
  private readonly data = new Map<string, unknown>();

  get<T>(key: string, defaultValue?: T): T {
    return (this.data.has(key) ? this.data.get(key) : defaultValue) as T;
  }

  async update(key: string, value: unknown): Promise<void> {
    this.data.set(key, value);
  }
}

describe('ServerRegistry', () => {
  it('add(url) 후 list()에 포함된다', async () => {
    const config = new FakeWorkspaceConfiguration();
    const registry = new ServerRegistry(() => config as never);

    await registry.add('https://yona.example.com');

    assert.deepStrictEqual(registry.list(), ['https://yona.example.com']);
  });

  it('remove(url) 후 목록에서 사라진다', async () => {
    const config = new FakeWorkspaceConfiguration();
    const registry = new ServerRegistry(() => config as never);
    await registry.add('https://a.example.com');
    await registry.add('https://b.example.com');

    await registry.remove('https://a.example.com');

    assert.deepStrictEqual(registry.list(), ['https://b.example.com']);
  });

  it('같은 url을 두 번 add해도 중복 저장되지 않는다', async () => {
    const config = new FakeWorkspaceConfiguration();
    const registry = new ServerRegistry(() => config as never);

    await registry.add('https://yona.example.com');
    await registry.add('https://yona.example.com');

    assert.deepStrictEqual(registry.list(), ['https://yona.example.com']);
  });

  it('setCurrent 후 getCurrent가 같은 값을 반환한다', async () => {
    const config = new FakeWorkspaceConfiguration();
    const registry = new ServerRegistry(() => config as never);

    await registry.setCurrent('https://yona.example.com');

    assert.strictEqual(registry.getCurrent(), 'https://yona.example.com');
  });

  it('등록된 서버가 없으면 list()는 빈 배열을 반환한다', () => {
    const config = new FakeWorkspaceConfiguration();
    const registry = new ServerRegistry(() => config as never);

    assert.deepStrictEqual(registry.list(), []);
  });
});
