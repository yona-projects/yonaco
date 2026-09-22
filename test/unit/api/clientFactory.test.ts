import * as assert from 'assert';
import { createScopedApiClient } from '../../../src/api/clientFactory';
import { ServerRegistry } from '../../../src/config/serverConfig';
import { TokenStore } from '../../../src/auth/tokenStore';
import { ApiClient } from '../../../src/api/client';

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

describe('createScopedApiClient', () => {
  it('현재 서버와 scoped 토큰이 모두 있으면 ApiClient를 반환한다', async () => {
    const config = new FakeWorkspaceConfiguration();
    const registry = new ServerRegistry(() => config as never);
    await registry.add('https://yona.example.com');
    await registry.setCurrent('https://yona.example.com');
    const tokenStore = new TokenStore(new FakeSecretStorage() as never);
    await tokenStore.setToken('https://yona.example.com', 'scoped', 'tok');

    const client = await createScopedApiClient(registry, tokenStore);

    assert.ok(client instanceof ApiClient);
  });

  it('현재 서버가 없으면 undefined를 반환한다', async () => {
    const registry = new ServerRegistry(() => new FakeWorkspaceConfiguration() as never);
    const tokenStore = new TokenStore(new FakeSecretStorage() as never);

    assert.strictEqual(await createScopedApiClient(registry, tokenStore), undefined);
  });

  it('현재 서버는 있지만 scoped 토큰이 없으면 undefined를 반환한다', async () => {
    const config = new FakeWorkspaceConfiguration();
    const registry = new ServerRegistry(() => config as never);
    await registry.add('https://yona.example.com');
    await registry.setCurrent('https://yona.example.com');
    const tokenStore = new TokenStore(new FakeSecretStorage() as never);

    assert.strictEqual(await createScopedApiClient(registry, tokenStore), undefined);
  });
});
