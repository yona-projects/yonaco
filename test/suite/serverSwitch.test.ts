import * as assert from 'assert';
import * as http from 'http';
import * as vscode from 'vscode';
import * as sinon from 'sinon';

function startMockServer(): Promise<{ server: http.Server; url: string; getLastAuthHeader: () => string | undefined }> {
  let lastAuthHeader: string | undefined;
  const server = http.createServer((req, res) => {
    lastAuthHeader = req.headers['authorization'] as string | undefined;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ issues: [], pullRequests: [] }));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address !== 'object') {
        throw new Error('목 서버 주소를 확인할 수 없습니다');
      }
      resolve({ server, url: `http://127.0.0.1:${address.port}`, getLastAuthHeader: () => lastAuthHeader });
    });
  });
}

describe('0.0.3 서버 전환 UX', () => {
  let sandbox: sinon.SinonSandbox;
  let serverA: Awaited<ReturnType<typeof startMockServer>>;
  let serverB: Awaited<ReturnType<typeof startMockServer>>;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    serverA = await startMockServer();
    serverB = await startMockServer();

    const config = vscode.workspace.getConfiguration('yona');
    await config.update('servers', [], vscode.ConfigurationTarget.Global);
    await config.update('currentServer', undefined, vscode.ConfigurationTarget.Global);
  });

  afterEach(async () => {
    sandbox.restore();
    await Promise.all([
      new Promise<void>((resolve) => serverA.server.close(() => resolve())),
      new Promise<void>((resolve) => serverB.server.close(() => resolve())),
    ]);
  });

  it('서버 전환 후 연결 테스트는 새로 선택한 서버로 요청을 보낸다', async () => {
    const showInputBox = sandbox.stub(vscode.window, 'showInputBox');
    showInputBox.onCall(0).resolves(serverA.url); // yona.server.add (A) -> current: A
    showInputBox.onCall(1).resolves('token-a'); // yona.auth.login -> A에 token-a 저장
    showInputBox.onCall(2).resolves(serverB.url); // yona.server.add (B, current는 A 유지)
    showInputBox.onCall(3).resolves('token-b'); // yona.auth.login -> (전환 후) B에 token-b 저장
    sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);
    sandbox.stub(vscode.window, 'showErrorMessage').resolves(undefined);
    const showQuickPick = sandbox.stub(vscode.window, 'showQuickPick');

    await vscode.commands.executeCommand('yona.server.add'); // current -> A (첫 서버)
    await vscode.commands.executeCommand('yona.auth.login'); // A에 token-a

    await vscode.commands.executeCommand('yona.server.add'); // B 등록, current는 그대로 A
    showQuickPick.onCall(0).resolves(serverB.url as never);
    await vscode.commands.executeCommand('yona.server.switch'); // current -> B
    assert.deepStrictEqual(showQuickPick.firstCall.args[0], [serverA.url, serverB.url]);
    await vscode.commands.executeCommand('yona.auth.login'); // B에 token-b

    await vscode.commands.executeCommand('yona.connectionTest');
    assert.strictEqual(serverB.getLastAuthHeader(), 'token token-b');

    showQuickPick.onCall(1).resolves(serverA.url as never);
    await vscode.commands.executeCommand('yona.server.switch'); // current -> A
    await vscode.commands.executeCommand('yona.connectionTest');
    assert.strictEqual(serverA.getLastAuthHeader(), 'token token-a');
  });
});
