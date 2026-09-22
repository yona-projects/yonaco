import { ServerRegistry } from '../config/serverConfig';
import { TokenStore } from './tokenStore';

export interface Prompter {
  askInput(options: { prompt: string; password?: boolean }): Promise<string | undefined>;
}

export async function promptAddServer(
  prompter: Prompter,
  serverRegistry: ServerRegistry,
): Promise<string | undefined> {
  const url = await prompter.askInput({
    prompt: '등록할 Yona 서버 URL을 입력하세요 (예: https://yona.example.com)',
  });
  if (!url) {
    return undefined;
  }

  await serverRegistry.add(url);
  if (!serverRegistry.getCurrent()) {
    await serverRegistry.setCurrent(url);
  }
  return url;
}

export async function promptLogin(
  prompter: Prompter,
  serverRegistry: ServerRegistry,
  tokenStore: TokenStore,
): Promise<boolean> {
  const serverUrl = serverRegistry.getCurrent();
  if (!serverUrl) {
    return false;
  }

  const token = await prompter.askInput({
    prompt: '스코프(fine-grained) 토큰을 입력하세요',
    password: true,
  });
  if (!token) {
    return false;
  }

  await tokenStore.setToken(serverUrl, 'scoped', token);
  return true;
}
