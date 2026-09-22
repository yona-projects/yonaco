import * as assert from 'assert';
import { ApiClient } from '../../../src/api/client';
import { ApiError } from '../../../src/api/apiError';

function fakeFetch(status: number, body: unknown, isJson = true) {
  return async (_url: string, _init?: unknown) => {
    return {
      status,
      ok: status >= 200 && status < 300,
      headers: {
        get: (_name: string) => (isJson ? 'application/json' : 'text/plain'),
      },
      json: async () => body,
      text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    } as unknown as Response;
  };
}

describe('ApiClient', () => {
  it('GET 요청에 Authorization: token <값> 헤더를 붙인다', async () => {
    let capturedHeaders: Record<string, string> | undefined;
    const fetchFn = async (_url: string, init?: RequestInit) => {
      capturedHeaders = init?.headers as Record<string, string>;
      return {
        status: 200,
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ hello: 'world' }),
        text: async () => '{"hello":"world"}',
      } as unknown as Response;
    };
    const client = new ApiClient('https://yona.example.com', 'secret-token', fetchFn);

    await client.getJSON('/api/v1/projects/owner');

    assert.strictEqual(capturedHeaders?.['Authorization'], 'token secret-token');
  });

  it('200 응답이면 JSON 바디를 파싱해 반환한다', async () => {
    const client = new ApiClient('https://yona.example.com', 't', fakeFetch(200, { id: 1 }));
    const result = await client.getJSON<{ id: number }>('/api/v1/projects/owner/proj/issues/1');
    assert.deepStrictEqual(result, { id: 1 });
  });

  it('4xx 응답이면 ApiError를 던지고 method/path/status/body를 담는다', async () => {
    const client = new ApiClient('https://yona.example.com', 't', fakeFetch(404, { message: 'not found' }));

    await assert.rejects(
      () => client.getJSON('/api/v1/projects/owner/proj/issues/999'),
      (err: unknown) => {
        assert.ok(err instanceof ApiError);
        const apiErr = err as ApiError;
        assert.strictEqual(apiErr.method, 'GET');
        assert.strictEqual(apiErr.path, '/api/v1/projects/owner/proj/issues/999');
        assert.strictEqual(apiErr.status, 404);
        assert.ok(apiErr.body.includes('not found'));
        return true;
      },
    );
  });

  it('5xx 응답이어도 동일하게 ApiError를 던진다', async () => {
    const client = new ApiClient('https://yona.example.com', 't', fakeFetch(500, { error: 'boom' }));
    await assert.rejects(() => client.getJSON('/api/v1/projects/owner'), ApiError);
  });

  it('baseURL 끝의 슬래시는 제거하고 경로를 이어 붙인다', async () => {
    let capturedUrl: string | undefined;
    const fetchFn = async (url: string) => {
      capturedUrl = url;
      return {
        status: 200,
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({}),
        text: async () => '{}',
      } as unknown as Response;
    };
    const client = new ApiClient('https://yona.example.com/', 't', fetchFn);
    await client.getJSON('/api/v1/projects/owner');
    assert.strictEqual(capturedUrl, 'https://yona.example.com/api/v1/projects/owner');
  });
});
