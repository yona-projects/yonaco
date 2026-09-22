export class ApiError extends Error {
  readonly method: string;
  readonly path: string;
  readonly status: number;
  readonly body: string;

  constructor(method: string, path: string, status: number, body: string) {
    super(`${method} ${path} -> ${status}: ${body.slice(0, 500)}`);
    this.name = 'ApiError';
    this.method = method;
    this.path = path;
    this.status = status;
    this.body = body;
  }
}
