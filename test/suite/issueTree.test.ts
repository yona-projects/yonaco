import * as assert from 'assert';
import * as http from 'http';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import type { IssueTreeProvider } from '../../src/tree/issueTreeProvider';
import type { IssueNode } from '../../src/tree/issueTreeItem';
import type { YonacoExports } from '../../src/extension';

const P = '/-_-api/v1/owners/owner1/projects/proj1';

// v2 서버의 이슈 상세(IssueJson)와 목록 항목(issueSummary) 모양이다.
function detail(overrides: Record<string, unknown>) {
  return {
    number: 1,
    id: 1,
    title: '프로젝트 이슈',
    body: '본문내용',
    state: 'OPEN',
    author: { loginId: 'admin', name: '관리자', email: 'admin@example.com' },
    owner: 'owner1',
    projectName: 'proj1',
    ...overrides,
  };
}

function summary(overrides: Record<string, unknown>) {
  return {
    number: 1,
    id: 1,
    title: '프로젝트 이슈',
    state: 'open',
    author: { loginId: 'admin', name: '관리자' },
    assignees: [],
    numOfComments: 0,
    url: '/owner1/proj1/issue/1',
    ...overrides,
  };
}

describe('0.1.1/0.1.2 이슈 사이드바 + 상세 웹뷰', () => {
  let sandbox: sinon.SinonSandbox;
  let server: http.Server;
  let serverUrl: string;
  let lastRequest: { method?: string; url?: string; body?: unknown } | undefined;
  let issueState: string;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    issueState = 'OPEN';
    server = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (chunk) => (raw += chunk));
      req.on('end', () => {
        lastRequest = { method: req.method, url: req.url, body: raw ? JSON.parse(raw) : undefined };

        if (req.method === 'POST' && req.url === `${P}/issues/1/comments`) {
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              result: detail({
                state: issueState,
                comments: [
                  { id: 500, type: 'ISSUE_COMMENT', author: { loginId: 'carol', name: '캐롤' }, createdAt: 'a', body: '이전에 달린 댓글' },
                  { id: 999, type: 'ISSUE_COMMENT', author: { loginId: 'admin', name: '관리자' }, createdAt: 'b', body: (lastRequest.body as { comment: string }).comment },
                ],
              }),
            }),
          );
          return;
        }

        if (req.method === 'PATCH' && req.url === `${P}/issues/1`) {
          issueState = (lastRequest.body as { state: string }).state === 'closed' ? 'CLOSED' : 'OPEN';
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ result: detail({ state: issueState }) }));
          return;
        }

        if (req.method === 'GET' && req.url === `${P}/issues/1/comments`) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              result: [{ id: 500, type: 'ISSUE_COMMENT', author: { loginId: 'carol', name: '캐롤' }, createdAt: 'a', body: '이전에 달린 댓글' }],
            }),
          );
          return;
        }

        if (req.method === 'GET' && req.url === `${P}/issues/1`) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ result: detail({ state: issueState }) }));
          return;
        }

        // GET .../issues?state=open -> 서버가 상태 필터링하는 것과 동일하게, 현재 상태가
        // OPEN일 때만 이슈를 목록에 포함시킨다(닫힌 이슈는 open 목록에서 사라져야 한다).
        const items = issueState === 'OPEN' ? [summary({})] : [];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ items, page: 1, pageSize: 15, totalPages: 1, totalCount: items.length }));
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
    // 확장은 프로세스 전체 수명 동안 살아있어서, 이전 테스트에서 연 이슈 상세 패널이 이번
    // 목 서버가 닫힌 뒤에도 남아 다음 테스트가 그 죽은 서버를 가리키는 패널을 재사용하는 문제가
    // 있었다 - 같은 owner/project/number 조합을 쓰는 모든 테스트가 매번 새 패널로 시작하도록
    // 정리한다.
    const extension = vscode.extensions.getExtension('yonaprojects.yonaco');
    const exports = (await extension?.activate()) as { issuePanels?: { getPanel(o: string, n: string, i: number): { dispose(): void } | undefined } } | undefined;
    exports?.issuePanels?.getPanel('owner1', 'proj1', 1)?.dispose();
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
    assert.strictEqual(lastRequest?.url, `${P}/issues?state=open`);
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
    await panel!.waitUntilLoaded();
    assert.ok(panel!.html.includes('프로젝트 이슈'));
    assert.ok(panel!.html.includes('본문내용'));

    await panel!.handleMessage({ type: 'addComment', contents: '테스트 코멘트' });

    assert.strictEqual(lastRequest?.method, 'POST');
    assert.strictEqual(lastRequest?.url, `${P}/issues/1/comments`);
    assert.deepStrictEqual(lastRequest?.body, { comment: '테스트 코멘트' });
    assert.ok(panel!.html.includes('테스트 코멘트'));
  });

  it('상세 패널에 담당자, 마일스톤, 기한이 보이고 없는 값은 없음으로 보인다', async () => {
    const exports = await loginAndRegisterProject();
    const provider = exports.issueTreeProvider;
    const [projectNode] = await provider.getChildren();
    const [issueNode] = (await provider.getChildren(projectNode)) as IssueNode[];

    await vscode.commands.executeCommand('yona.issue.open', issueNode);
    const panel = exports.issuePanels.getPanel('owner1', 'proj1', 1)!;
    await panel.waitUntilLoaded();

    assert.ok(panel.html.includes('property-label">담당자'));
    assert.ok(panel.html.includes('property-label">마일스톤'));
    assert.ok(panel.html.includes('property-label">기한'));
    assert.ok(panel.html.includes('property-label">라벨'));
    assert.strictEqual((panel.html.match(/class="empty">없음/g) ?? []).length, 4, '네 값이 모두 없으면 없음이 네 번이다');
  });

  it('이슈를 열면 서버에 이미 있던 코멘트 이력을 불러와 함께 보여준다', async () => {
    const exports = await loginAndRegisterProject();
    const provider = exports.issueTreeProvider;

    const [projectNode] = await provider.getChildren();
    const [issueNode] = (await provider.getChildren(projectNode)) as IssueNode[];

    await vscode.commands.executeCommand('yona.issue.open', issueNode);
    const panel = exports.issuePanels.getPanel('owner1', 'proj1', 1)!;
    await panel.waitUntilLoaded();

    assert.ok(panel.html.includes('이전에 달린 댓글'), '이전 세션에 이미 달려있던 댓글도 보여야 한다');
    assert.ok(panel.html.includes('캐롤'), '댓글 작성자는 이름으로 보인다');
  });

  it("상세 웹뷰에서 '완료' 처리하면 PATCH state closed가 호출되고 트리에서 사라진다, '재오픈'하면 다시 나타난다", async () => {
    const exports = await loginAndRegisterProject();
    const provider = exports.issueTreeProvider;

    const [projectNode] = await provider.getChildren();
    const [issueNode] = (await provider.getChildren(projectNode)) as IssueNode[];
    await vscode.commands.executeCommand('yona.issue.open', issueNode);
    const panel = exports.issuePanels.getPanel('owner1', 'proj1', 1)!;
    await panel.waitUntilLoaded();

    await panel.handleMessage({ type: 'closeIssue' });

    assert.strictEqual(lastRequest?.method, 'PATCH');
    assert.strictEqual(lastRequest?.url, `${P}/issues/1`);
    assert.deepStrictEqual(lastRequest?.body, { state: 'closed' });
    assert.ok(panel.html.includes('CLOSED'));
    assert.ok(panel.html.includes('재오픈'));

    const issuesAfterClose = (await provider.getChildren(projectNode)) as IssueNode[];
    assert.deepStrictEqual(
      issuesAfterClose.map((node) => node.type),
      ['empty'],
      '열린 이슈가 없으면 안내 항목 하나만 남는다',
    );

    await panel.handleMessage({ type: 'reopenIssue' });

    assert.deepStrictEqual(lastRequest?.body, { state: 'open' });
    assert.ok(panel.html.includes('OPEN'));

    const issuesAfterReopen = (await provider.getChildren(projectNode)) as IssueNode[];
    assert.strictEqual(issuesAfterReopen.length, 1);
  });
});
