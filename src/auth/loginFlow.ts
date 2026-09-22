import { ServerRegistry } from '../config/serverConfig';
import { TokenKind, TokenStore } from './tokenStore';

export interface Prompter {
  askInput(options: { prompt: string; password?: boolean }): Promise<string | undefined>;
  askPick(items: string[], placeHolder?: string): Promise<string | undefined>;
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

const PROMPT_BY_KIND: Record<TokenKind, string> = {
  scoped: '스코프(fine-grained) 토큰을 입력하세요',
  legacy: '레거시 전권 토큰을 입력하세요 (라인 리뷰 코멘트/온라인 커밋/브랜치 관리에 사용됩니다)',
};

export async function promptLogin(
  prompter: Prompter,
  serverRegistry: ServerRegistry,
  tokenStore: TokenStore,
  kind: TokenKind = 'scoped',
): Promise<boolean> {
  const serverUrl = serverRegistry.getCurrent();
  if (!serverUrl) {
    return false;
  }

  const token = await prompter.askInput({
    prompt: PROMPT_BY_KIND[kind],
    password: true,
  });
  if (!token) {
    return false;
  }

  await tokenStore.setToken(serverUrl, kind, token);
  return true;
}

export async function promptSwitchServer(
  prompter: Prompter,
  serverRegistry: ServerRegistry,
): Promise<string | undefined> {
  const servers = serverRegistry.list();
  if (servers.length === 0) {
    return undefined;
  }

  const picked = await prompter.askPick(servers, '전환할 Yona 서버를 선택하세요');
  if (!picked) {
    return undefined;
  }

  await serverRegistry.setCurrent(picked);
  return picked;
}
