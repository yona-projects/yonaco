import * as assert from 'assert';
import * as http from 'http';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import type { IssueTreeProvider } from '../../src/tree/issueTreeProvider';
import type { IssueNode } from '../../src/tree/issueTreeItem';
import type { YonacoExports } from '../../src/extension';

function fakeIssue(overrides: Record<string, unknown>) {
  return {
    id: 1,
    number: 1,
    title: 'title',
    body: '',
    state: 'OPEN',
    projectId: 1,
    authorLoginId: 'admin',
    numOfComments: 0,
    ...overrides,
  };
}

describe('0.1.1/0.1.2 이슈 사이드바 + 상세 웹뷰', () => {
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

        if (req.method === 'POST' && req.url?.includes('/comments')) {
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              id: 999,
              contents: (lastRequest.body as { contents: string }).contents,
              authorLoginId: 'admin',
              authorName: 'Admin',
              issueId: 1,
            }),
          );
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            content: [fakeIssue({ id: 1, number: 1, title: '프로젝트 이슈', body: '본문내용' })],
            totalElements: 1,
            totalPages: 1,
            number: 0,
            size: 20,
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

  async function loginAndRegisterProject(): Promise<YonacoExports> {
    const showInputBox = sandbox.stub(vscode.window, 'showInputBox');
    showInputBox.onCall(0).resolves(serverUrl); // yona.server.add
    showInputBox.onCall(1).resolves('scoped-token'); // yona.auth.login
    showInputBox.onCall(2).resolves('owner1/proj1'); // yona.project.add
    sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);
    sandbox.stub(vscode.window, 'showErrorMessage').resolves(undefined);

    await vscode.commands.executeCommand('yona.server.add');
    await vscode.commands.executeCommand('yona.auth.login');
    await vscode.commands.executeCommand('yona.project.add');

    const extension = vscode.extensions.getExtension('yonaprojects.yonaco');
    return (await extension!.activate()) as YonacoExports;
  }

  it('이슈 트리뷰가 등록된 프로젝트별로 그룹핑되어 실제 이슈 제목들을 렌더링한다', async () => {
    const exports = await loginAndRegisterProject();
    const provider: IssueTreeProvider = exports.issueTreeProvider;

    const projectNodes = await provider.getChildren();
    assert.strictEqual(projectNodes.length, 1);
    assert.strictEqual(provider.getTreeItem(projectNodes[0]).label, 'owner1/proj1');

    const issueNodes: IssueNode[] = (await provider.getChildren(projectNodes[0])) as IssueNode[];
    assert.strictEqual(issueNodes.length, 1);
    assert.strictEqual(provider.getTreeItem(issueNodes[0]).label, '#1 프로젝트 이슈');
    assert.strictEqual(lastRequest?.url, '/api/v1/projects/owner1/proj1/issues?state=open');
  });

  it('로그인 전에는 빈 목록을 반환한다', async () => {
    const extension = vscode.extensions.getExtension('yonaprojects.yonaco');
    const exports = (await extension!.activate()) as YonacoExports;

    assert.deepStrictEqual(await exports.issueTreeProvider.getChildren(), []);
  });

  it('이슈를 열면 상세 웹뷰가 뜨고, 코멘트를 작성하면 POST가 호출되고 화면에 반영된다', async () => {
    const exports = await loginAndRegisterProject();
    const provider = exports.issueTreeProvider;

    const [projectNode] = await provider.getChildren();
    const [issueNode] = (await provider.getChildren(projectNode)) as IssueNode[];

    await vscode.commands.executeCommand('yona.issue.open', issueNode);

    const panel = exports.issuePanels.getPanel('owner1', 'proj1', 1);
    assert.ok(panel, '이슈 상세 패널이 생성되어야 한다');
    assert.ok(panel!.html.includes('프로젝트 이슈'));
    assert.ok(panel!.html.includes('본문내용'));

    await panel!.handleMessage({ type: 'addComment', contents: '테스트 코멘트' });

    assert.strictEqual(lastRequest?.method, 'POST');
    assert.strictEqual(lastRequest?.url, '/api/v1/projects/owner1/proj1/issues/1/comments');
    assert.deepStrictEqual(lastRequest?.body, { contents: '테스트 코멘트' });
    assert.ok(panel!.html.includes('테스트 코멘트'));
  });
});
