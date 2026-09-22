import { ServerRegistry } from '../config/serverConfig';
import { TokenStore } from '../auth/tokenStore';
import { ApiClient } from './client';

export async function createScopedApiClient(
  serverRegistry: ServerRegistry,
  tokenStore: TokenStore,
): Promise<ApiClient | undefined> {
  const serverUrl = serverRegistry.getCurrent();
  if (!serverUrl) {
    return undefined;
  }

  const token = await tokenStore.getToken(serverUrl, 'scoped');
  if (!token) {
    return undefined;
  }

  return new ApiClient(serverUrl, token);
}
