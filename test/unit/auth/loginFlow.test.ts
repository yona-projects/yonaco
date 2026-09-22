import * as assert from 'assert';
import { promptAddServer, promptLogin, Prompter } from '../../../src/auth/loginFlow';
import { ServerRegistry } from '../../../src/config/serverConfig';
import { TokenStore } from '../../../src/auth/tokenStore';

class FakeWorkspaceConfiguration {
  private readonly data = new Map<string, unknown>();
  get<T>(key: string, defaultValue?: T): T {
    return (this.data.has(key) ? this.data.get(key) : defaultValue) as T;
  }
  async update(key: string, value: unknown): Promise<void> {
    this.data.set(key, value);
  }
}

class FakeSecretStorage {
  private readonly values = new Map<string, string>();
  async get(key: string): Promise<string | undefined> {
    return this.values.get(key);
  }
  async store(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }
}

function fakePrompter(answer: string | undefined): Prompter {
  return { askInput: async () => answer };
}

describe('promptAddServer', () => {
  it('입력한 URL을 서버 목록에 등록하고, 첫 서버면 currentServer로도 설정한다', async () => {
    const config = new FakeWorkspaceConfiguration();
    const registry = new ServerRegistry(() => config as never);
    const url = await promptAddServer(fakePrompter('https://yona.example.com'), registry);

    assert.strictEqual(url, 'https://yona.example.com');
    assert.deepStrictEqual(registry.list(), ['https://yona.example.com']);
    assert.strictEqual(registry.getCurrent(), 'https://yona.example.com');
  });

  it('사용자가 입력을 취소하면(undefined) 아무것도 등록하지 않는다', async () => {
    const registry = new ServerRegistry(() => new FakeWorkspaceConfiguration() as never);
    const url = await promptAddServer(fakePrompter(undefined), registry);

    assert.strictEqual(url, undefined);
    assert.deepStrictEqual(registry.list(), []);
  });
});

describe('promptLogin', () => {
  it('등록된 서버가 있으면 입력받은 토큰을 scoped 슬롯에 저장한다', async () => {
    const config = new FakeWorkspaceConfiguration();
    const registry = new ServerRegistry(() => config as never);
    await registry.add('https://yona.example.com');
    await registry.setCurrent('https://yona.example.com');
    const tokenStore = new TokenStore(new FakeSecretStorage() as never);

    const ok = await promptLogin(fakePrompter('secret-token'), registry, tokenStore);

    assert.strictEqual(ok, true);
    assert.strictEqual(await tokenStore.getToken('https://yona.example.com', 'scoped'), 'secret-token');
  });

  it('등록된 서버가 없으면 false를 반환하고 아무것도 저장하지 않는다', async () => {
    const registry = new ServerRegistry(() => new FakeWorkspaceConfiguration() as never);
    const tokenStore = new TokenStore(new FakeSecretStorage() as never);

    const ok = await promptLogin(fakePrompter('secret-token'), registry, tokenStore);

    assert.strictEqual(ok, false);
  });

  it('토큰 입력을 취소하면(undefined) false를 반환한다', async () => {
    const config = new FakeWorkspaceConfiguration();
    const registry = new ServerRegistry(() => config as never);
    await registry.add('https://yona.example.com');
    const tokenStore = new TokenStore(new FakeSecretStorage() as never);

    const ok = await promptLogin(fakePrompter(undefined), registry, tokenStore);

    assert.strictEqual(ok, false);
  });

  it("kind에 'legacy'를 넘기면 legacy 슬롯에 저장하고 scoped 슬롯은 건드리지 않는다", async () => {
    const config = new FakeWorkspaceConfiguration();
    const registry = new ServerRegistry(() => config as never);
    await registry.add('https://yona.example.com');
    await registry.setCurrent('https://yona.example.com');
    const tokenStore = new TokenStore(new FakeSecretStorage() as never);

    const ok = await promptLogin(fakePrompter('legacy-token'), registry, tokenStore, 'legacy');

    assert.strictEqual(ok, true);
    assert.strictEqual(await tokenStore.getToken('https://yona.example.com', 'legacy'), 'legacy-token');
    assert.strictEqual(await tokenStore.getToken('https://yona.example.com', 'scoped'), undefined);
  });
});
