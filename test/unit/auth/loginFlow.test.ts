import * as assert from 'assert';
import { ADD_SERVER_ITEM, promptAddServer, promptLogin, promptSwitchServer, Prompter } from '../../../src/auth/loginFlow';
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
  return { askInput: async () => answer, askPick: async () => answer };
}

function fakePickPrompter(pickAnswer: string | undefined): Prompter {
  return { askInput: async () => undefined, askPick: async () => pickAnswer };
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
});

describe('promptSwitchServer', () => {
  it('등록된 서버 목록에서 선택한 서버로 currentServer를 바꾼다', async () => {
    const config = new FakeWorkspaceConfiguration();
    const registry = new ServerRegistry(() => config as never);
    await registry.add('https://a.example.com');
    await registry.add('https://b.example.com');
    await registry.setCurrent('https://a.example.com');

    const picked = await promptSwitchServer(fakePickPrompter('https://b.example.com'), registry);

    assert.strictEqual(picked, 'https://b.example.com');
    assert.strictEqual(registry.getCurrent(), 'https://b.example.com');
  });

  it('등록된 서버가 없으면 선택창을 띄우지 않고 undefined를 반환한다', async () => {
    const registry = new ServerRegistry(() => new FakeWorkspaceConfiguration() as never);

    const picked = await promptSwitchServer(fakePickPrompter('아무값'), registry);

    assert.strictEqual(picked, undefined);
    assert.strictEqual(registry.getCurrent(), undefined);
  });

  it('선택을 취소하면(undefined) currentServer를 바꾸지 않는다', async () => {
    const config = new FakeWorkspaceConfiguration();
    const registry = new ServerRegistry(() => config as never);
    await registry.add('https://a.example.com');
    await registry.setCurrent('https://a.example.com');

    const picked = await promptSwitchServer(fakePickPrompter(undefined), registry);

    assert.strictEqual(picked, undefined);
    assert.strictEqual(registry.getCurrent(), 'https://a.example.com');
  });
});

describe('서버 추가 화면(UI) 흐름', () => {
  function recordingPrompter(inputs: Array<string | undefined>, pick?: string) {
    const picks: string[][] = [];
    const validators: Array<((value: string) => string | undefined) | undefined> = [];
    const prompter: Prompter = {
      askInput: async (options) => {
        validators.push(options.validate);
        return inputs.shift();
      },
      askPick: async (items) => {
        picks.push(items);
        return pick;
      },
    };
    return { prompter, picks, validators };
  }

  it('입력한 주소의 앞뒤 공백과 끝의 슬래시를 정리해 등록한다', async () => {
    const config = new FakeWorkspaceConfiguration();
    const registry = new ServerRegistry(() => config as never);

    const url = await promptAddServer(fakePrompter('  https://yona.example.com/yona/  '), registry);

    assert.strictEqual(url, 'https://yona.example.com/yona');
    assert.deepStrictEqual(registry.list(), ['https://yona.example.com/yona']);
  });

  it('http나 https로 시작하지 않는 주소는 등록하지 않는다', async () => {
    const config = new FakeWorkspaceConfiguration();
    const registry = new ServerRegistry(() => config as never);

    assert.strictEqual(await promptAddServer(fakePrompter('yona.example.com'), registry), undefined);
    assert.strictEqual(await promptAddServer(fakePrompter('ftp://yona.example.com'), registry), undefined);
    assert.deepStrictEqual(registry.list(), []);
  });

  it('입력창에 주소 형식 검사 함수를 넘겨 잘못된 값은 입력 중에 안내한다', async () => {
    const config = new FakeWorkspaceConfiguration();
    const registry = new ServerRegistry(() => config as never);
    const { prompter, validators } = recordingPrompter(['https://yona.example.com']);

    await promptAddServer(prompter, registry);

    const validate = validators[0];
    assert.ok(validate, '검사 함수가 전달되어야 한다');
    assert.ok(validate('yona.example.com'), '형식이 틀리면 안내 문구를 돌려준다');
    assert.strictEqual(validate('https://yona.example.com'), undefined);
    assert.strictEqual(validate('http://localhost:9000'), undefined);
  });

  it('서버 전환 목록의 맨 끝에 "서버 추가..." 항목이 있다', async () => {
    const config = new FakeWorkspaceConfiguration();
    const registry = new ServerRegistry(() => config as never);
    await registry.add('https://a.example.com');
    const { prompter, picks } = recordingPrompter([], undefined);

    await promptSwitchServer(prompter, registry);

    assert.deepStrictEqual(picks[0], ['https://a.example.com', ADD_SERVER_ITEM]);
  });

  it('"서버 추가..."를 고르면 주소를 물어 등록하고 그 서버로 전환한다', async () => {
    const config = new FakeWorkspaceConfiguration();
    const registry = new ServerRegistry(() => config as never);
    await registry.add('https://a.example.com');
    await registry.setCurrent('https://a.example.com');
    const { prompter } = recordingPrompter(['https://b.example.com'], ADD_SERVER_ITEM);

    const picked = await promptSwitchServer(prompter, registry);

    assert.strictEqual(picked, 'https://b.example.com');
    assert.deepStrictEqual(registry.list(), ['https://a.example.com', 'https://b.example.com']);
    assert.strictEqual(registry.getCurrent(), 'https://b.example.com');
  });

  it('등록된 서버가 없을 때 서버 전환을 누르면 선택창 없이 바로 주소를 묻는다', async () => {
    const config = new FakeWorkspaceConfiguration();
    const registry = new ServerRegistry(() => config as never);
    const { prompter, picks } = recordingPrompter(['https://a.example.com']);

    const picked = await promptSwitchServer(prompter, registry);

    assert.strictEqual(picked, 'https://a.example.com');
    assert.deepStrictEqual(picks, []);
    assert.strictEqual(registry.getCurrent(), 'https://a.example.com');
  });
});
