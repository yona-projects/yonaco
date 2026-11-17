import * as assert from 'assert';
import * as http from 'http';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { createIssueCompletionProvider, createIssueLinkProvider } from '../../src/scm/commitMessageProvider';
import type { YonacoExports } from '../../src/extension';

describe('0.1.5 커밋 메시지 이슈번호 자동완성/링크', () => {
  let sandbox: sinon.SinonSandbox;
  let server: http.Server;
  let serverUrl: string;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    server = http.createServer((req, res) => {
      const base = '/-_-api/v1/owners/owner1/projects/proj1/issues';
      const json = (body: unknown) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
      };
      if (req.url === `${base}/12/comments`) {
        json({ result: [] });
        return;
      }
      if (req.url === `${base}/12`) {
        json({
          result: {
            number: 12,
            id: 1,
            title: '버그 수정',
            body: '',
            state: 'OPEN',
            author: { loginId: 'admin', name: '관리자', email: 'admin@example.com' },
            owner: 'owner1',
            projectName: 'proj1',
          },
        });
        return;
      }
      // v2 서버의 목록 항목(issueSummary) 모양이다. 응답은 items 배열을 가진 페이지이다.
      const issue = {
        id: 1,
        number: 12,
        title: '버그 수정',
        state: 'open',
        author: { loginId: 'admin', name: '관리자' },
        assignees: [],
        numOfComments: 0,
        url: '/owner1/proj1/issue/12',
      };

      json({ items: [issue], page: 1, pageSize: 15, totalPages: 1, totalCount: 1 });
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

  it('완성 provider가 등록된 프로젝트의 열린 이슈를 "#번호 제목" 항목으로 제공한다', async () => {
    const showInputBox = sandbox.stub(vscode.window, 'showInputBox');
    showInputBox.onCall(0).resolves(serverUrl);
    showInputBox.onCall(1).resolves('scoped-token');
    showInputBox.onCall(2).resolves('owner1/proj1');
    sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);
    sandbox.stub(vscode.window, 'showErrorMessage').resolves(undefined);
    await vscode.commands.executeCommand('yona.server.add');
    await vscode.commands.executeCommand('yona.auth.login');
    await vscode.commands.executeCommand('yona.project.add');

    const extension = vscode.extensions.getExtension('yonaprojects.yonaco');
    const exports = (await extension!.activate()) as YonacoExports;
    const { createScopedApiClient } = await import('../../src/api/clientFactory');

    const provider = createIssueCompletionProvider(
      () => createScopedApiClient(exports.serverRegistry, exports.tokenStore),
      exports.projectRegistry,
    );

    const items = (await provider.provideCompletionItems!(
      {} as vscode.TextDocument,
      {} as vscode.Position,
      {} as vscode.CancellationToken,
      {} as vscode.CompletionContext,
    )) as vscode.CompletionItem[];

    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].label, '#12 버그 수정');
    assert.strictEqual(items[0].insertText, '12');
    assert.strictEqual(items[0].detail, 'owner1/proj1');
  });

  it('링크 provider가 문서에서 "#12"를 찾아 yona.issue.openByNumber 커맨드 URI로 연결한다', () => {
    const provider = createIssueLinkProvider();
    const fakeDoc = {
      getText: () => 'Fix #12 today',
      positionAt: (offset: number) => new vscode.Position(0, offset),
    } as unknown as vscode.TextDocument;

    const links = provider.provideDocumentLinks!(fakeDoc, {} as vscode.CancellationToken) as vscode.DocumentLink[];

    assert.strictEqual(links.length, 1);
    assert.strictEqual(links[0].target?.scheme, 'command');
    assert.strictEqual(links[0].target?.path, 'yona.issue.openByNumber');
    assert.deepStrictEqual(JSON.parse(decodeURIComponent(links[0].target?.query ?? '')), [12]);
  });

  it('yona.issue.openByNumber 커맨드는 등록된 프로젝트를 순회해 해당 번호의 이슈 상세를 연다', async () => {
    const showInputBox = sandbox.stub(vscode.window, 'showInputBox');
    showInputBox.onCall(0).resolves(serverUrl);
    showInputBox.onCall(1).resolves('scoped-token');
    showInputBox.onCall(2).resolves('owner1/proj1');
    sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);
    sandbox.stub(vscode.window, 'showErrorMessage').resolves(undefined);
    await vscode.commands.executeCommand('yona.server.add');
    await vscode.commands.executeCommand('yona.auth.login');
    await vscode.commands.executeCommand('yona.project.add');

    const extension = vscode.extensions.getExtension('yonaprojects.yonaco');
    const exports = (await extension!.activate()) as YonacoExports;
    exports.issuePanels.getPanel('owner1', 'proj1', 12)?.dispose();

    await vscode.commands.executeCommand('yona.issue.openByNumber', 12);

    const panel = exports.issuePanels.getPanel('owner1', 'proj1', 12);
    assert.ok(panel, '해당 번호의 이슈 패널이 열려야 한다');
    await panel!.waitUntilLoaded();
    assert.ok(panel!.html.includes('버그 수정'));
    panel!.dispose();
  });
});
