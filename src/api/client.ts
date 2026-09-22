import { ApiError } from './apiError';

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export class ApiClient {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly token: string,
    private readonly fetchFn: FetchFn = fetch,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async getJSON<T>(path: string): Promise<T> {
    return this.requestJSON<T>('GET', path);
  }

  private async requestJSON<T>(method: string, path: string): Promise<T> {
    const response = await this.fetchFn(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `token ${this.token}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new ApiError(method, path, response.status, body);
    }

    return (await response.json()) as T;
  }
}
