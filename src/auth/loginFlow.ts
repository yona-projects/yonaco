import { ServerRegistry } from '../config/serverConfig';
import { TokenKind, TokenStore } from './tokenStore';
import { normalizeServerUrl, validateServerUrl } from '../config/serverUrl';

export interface Prompter {
  /** `validate`는 입력하는 동안 호출되며, 문자열을 돌려주면 그 문구를 안내하고 확정하지 못하게 한다. */
  askInput(options: {
    prompt: string;
    password?: boolean;
    validate?: (value: string) => string | undefined;
  }): Promise<string | undefined>;
  askPick(items: string[], placeHolder?: string): Promise<string | undefined>;
}

export async function promptAddServer(
  prompter: Prompter,
  serverRegistry: ServerRegistry,
): Promise<string | undefined> {
  const input = await prompter.askInput({
    prompt: '등록할 Yona 서버 URL을 입력하세요 (예: https://yona.example.com)',
    validate: validateServerUrl,
  });
  if (!input) {
    return undefined;
  }
  const url = normalizeServerUrl(input);
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
  scoped: 'Yona 개인 액세스 토큰을 입력하세요 (이슈 API에는 repo 범위, 공개 프로젝트만 쓰면 public_repo 범위가 필요합니다)',
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

/** 서버 전환 목록의 맨 끝에 두는, 새 서버를 등록하는 항목이다. */
export const ADD_SERVER_ITEM = '$(add) 서버 추가...';

/**
 * 서버를 전환한다. 목록 끝의 "서버 추가..."를 고르면 주소를 물어 등록하고 그 서버로 전환한다.
 * 등록된 서버가 하나도 없으면 선택창 없이 바로 주소를 묻는다.
 */
export async function promptSwitchServer(
  prompter: Prompter,
  serverRegistry: ServerRegistry,
): Promise<string | undefined> {
  const servers = serverRegistry.list();
  const picked =
    servers.length === 0
      ? ADD_SERVER_ITEM
      : await prompter.askPick([...servers, ADD_SERVER_ITEM], '전환할 Yona 서버를 선택하세요');
  if (!picked) {
    return undefined;
  }

  if (picked === ADD_SERVER_ITEM) {
    const added = await promptAddServer(prompter, serverRegistry);
    if (!added) {
      return undefined;
    }
    await serverRegistry.setCurrent(added);
    return added;
  }

  await serverRegistry.setCurrent(picked);
  return picked;
}
