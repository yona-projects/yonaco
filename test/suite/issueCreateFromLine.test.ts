import * as assert from 'assert';
import * as http from 'http';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import type { YonacoExports } from '../../src/extension';

describe('0.1.4 이 라인으로 이슈 생성', () => {
  let sandbox: sinon.SinonSandbox;
  let server: http.Server;
  let serverUrl: string;
  let lastRequest: { method?: string; url?: string; body?: unknown } | undefined;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    server = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (chunk) => (raw += chunk));
      req.on('end', () => {
        lastRequest = { method: req.method, url: req.url, body: raw ? JSON.parse(raw) : undefined };
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            id: 55,
            number: 7,
            title: (lastRequest.body as { title: string }).title,
            body: (lastRequest.body as { body: string }).body,
            state: 'OPEN',
            projectId: 1,
            authorLoginId: 'admin',
            numOfComments: 0,
          }),
        );
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address !== 'object') {
      throw new Error('목 서버 주소를 확인할 수 없습니다');
    }
    serverUrl = `http://127.0.0.1:${address.port}`;

    const config = vscode.workspace.getConfiguration('yona');
    await config.update('servers', [], vscode.ConfigurationTarget.Global);
    await config.update('currentServer', undefined, vscode.ConfigurationTarget.Global);
    await config.update('projects', [], vscode.ConfigurationTarget.Global);
  });

  afterEach(async () => {
    sandbox.restore();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('활성 편집기의 파일경로:라인이 본문에 채워진 이슈 생성 요청을 보내고, 성공하면 트리가 새로고침된다', async () => {
    const showInputBox = sandbox.stub(vscode.window, 'showInputBox');
    showInputBox.onCall(0).resolves(serverUrl); // yona.server.add
    showInputBox.onCall(1).resolves('scoped-token'); // yona.auth.login
    showInputBox.onCall(2).resolves('owner1/proj1'); // yona.project.add
    showInputBox.onCall(3).resolves('여기 버그가 있어요'); // yona.issue.createFromLine의 제목 입력
    sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);
    sandbox.stub(vscode.window, 'showErrorMessage').resolves(undefined);

    await vscode.commands.executeCommand('yona.server.add');
    await vscode.commands.executeCommand('yona.auth.login');
    await vscode.commands.executeCommand('yona.project.add');

    const doc = await vscode.workspace.openTextDocument({ content: 'line1\nline2\nline3\n' });
    const editor = await vscode.window.showTextDocument(doc);
    editor.selection = new vscode.Selection(2, 0, 2, 0); // 3번째 줄(0-indexed 2) -> 1-indexed 3
    const expectedPath = vscode.workspace.asRelativePath(doc.uri);

    const extension = vscode.extensions.getExtension('yonaprojects.yonaco');
    const exports = (await extension!.activate()) as YonacoExports;
    const refreshSpy = sandbox.spy(exports.issueTreeProvider, 'refresh');

    await vscode.commands.executeCommand('yona.issue.createFromLine');

    assert.strictEqual(lastRequest?.method, 'POST');
    assert.strictEqual(lastRequest?.url, '/api/v1/projects/owner1/proj1/issues');
    assert.deepStrictEqual(lastRequest?.body, {
      title: '여기 버그가 있어요',
      body: `${expectedPath}:3`,
    });
    assert.ok(refreshSpy.called, '이슈 생성 후 트리가 새로고침되어야 한다');
  });
});
