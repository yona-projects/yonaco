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

  async postJSON<T>(path: string, body?: unknown): Promise<T> {
    return this.requestJSON<T>('POST', path, body);
  }

  private async requestJSON<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `token ${this.token}`,
      Accept: 'application/json',
    };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await this.fetchFn(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const responseBody = await response.text();
      throw new ApiError(method, path, response.status, responseBody);
    }

    return (await response.json()) as T;
  }
}
