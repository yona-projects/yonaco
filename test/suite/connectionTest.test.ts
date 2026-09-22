import * as assert from 'assert';
import * as http from 'http';
import * as vscode from 'vscode';
import * as sinon from 'sinon';

describe('0.0.1 서버 등록 + 로그인 + 연결 테스트', () => {
  let server: http.Server;
  let serverUrl: string;
  let receivedAuthHeader: string | undefined;
  let sandbox: sinon.SinonSandbox;

  beforeEach(async () => {
    receivedAuthHeader = undefined;
    server = http.createServer((req, res) => {
      receivedAuthHeader = req.headers['authorization'] as string | undefined;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ issues: [], pullRequests: [] }));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (address && typeof address === 'object') {
      serverUrl = `http://127.0.0.1:${address.port}`;
    } else {
      throw new Error('목 서버 주소를 확인할 수 없습니다');
    }

    sandbox = sinon.createSandbox();

    // 이전 테스트/설정에서 남은 값을 정리한다.
    const config = vscode.workspace.getConfiguration('yona');
    await config.update('servers', [], vscode.ConfigurationTarget.Global);
    await config.update('currentServer', undefined, vscode.ConfigurationTarget.Global);
  });

  afterEach(async () => {
    sandbox.restore();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('서버 등록 -> 로그인 -> 연결 테스트 순서로 실행하면 Authorization 헤더가 붙은 요청이 서버에 도달하고 성공 메시지가 뜬다', async () => {
    const showInputBox = sandbox.stub(vscode.window, 'showInputBox');
    showInputBox.onCall(0).resolves(serverUrl); // yona.server.add
    showInputBox.onCall(1).resolves('secret-scoped-token'); // yona.auth.login

    const showInformationMessage = sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);
    const showErrorMessage = sandbox.stub(vscode.window, 'showErrorMessage').resolves(undefined);

    await vscode.commands.executeCommand('yona.server.add');
    await vscode.commands.executeCommand('yona.auth.login');
    await vscode.commands.executeCommand('yona.connectionTest');

    assert.strictEqual(receivedAuthHeader, 'token secret-scoped-token');
    assert.ok(
      showInformationMessage.calledWithMatch(sinon.match(/연결 성공/)),
      `성공 메시지가 표시되어야 한다. 실제 호출: ${JSON.stringify(showInformationMessage.args)}`,
    );
    assert.strictEqual(showErrorMessage.called, false);
  });

  it('서버/토큰이 없는 상태로 연결 테스트를 실행하면 에러 메시지를 보여주고 아무 요청도 보내지 않는다', async () => {
    const showErrorMessage = sandbox.stub(vscode.window, 'showErrorMessage').resolves(undefined);

    await vscode.commands.executeCommand('yona.connectionTest');

    assert.strictEqual(receivedAuthHeader, undefined);
    assert.ok(showErrorMessage.calledWithMatch(sinon.match(/등록된 서버\/토큰이 없습니다/)));
  });
});
