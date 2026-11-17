import * as assert from 'assert';
import { TokenStore } from '../../../src/auth/tokenStore';

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

describe('TokenStore', () => {
  it('setToken 후 getToken이 같은 값을 반환한다', async () => {
    const secrets = new FakeSecretStorage();
    const tokenStore = new TokenStore(secrets as never);

    await tokenStore.setToken('https://yona.example.com', 'scoped', 'abc123');

    assert.strictEqual(await tokenStore.getToken('https://yona.example.com', 'scoped'), 'abc123');
  });

  it('deleteToken 후에는 getToken이 undefined를 반환한다', async () => {
    const secrets = new FakeSecretStorage();
    const tokenStore = new TokenStore(secrets as never);
    await tokenStore.setToken('https://yona.example.com', 'scoped', 'zzz');

    await tokenStore.deleteToken('https://yona.example.com', 'scoped');

    assert.strictEqual(await tokenStore.getToken('https://yona.example.com', 'scoped'), undefined);
  });

  it('서로 다른 서버 URL은 서로 다른 슬롯에 저장된다', async () => {
    const secrets = new FakeSecretStorage();
    const tokenStore = new TokenStore(secrets as never);

    await tokenStore.setToken('https://a.example.com', 'scoped', 'token-a');
    await tokenStore.setToken('https://b.example.com', 'scoped', 'token-b');

    assert.strictEqual(await tokenStore.getToken('https://a.example.com', 'scoped'), 'token-a');
    assert.strictEqual(await tokenStore.getToken('https://b.example.com', 'scoped'), 'token-b');
  });
});
