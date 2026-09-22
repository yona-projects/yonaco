import * as assert from 'assert';
import * as http from 'http';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import type { IssueTreeProvider } from '../../src/tree/issueTreeProvider';
import type { IssueTreeNode } from '../../src/tree/issueTreeItem';

function fakeIssue(overrides: Record<string, unknown>) {
  return {
    id: 1,
    number: 1,
    title: 'title',
    state: 'OPEN',
    projectId: 1,
    authorLoginId: 'admin',
    numOfComments: 0,
    ...overrides,
  };
}

describe('0.1.1 이슈 목록 사이드바', () => {
  let sandbox: sinon.SinonSandbox;
  let server: http.Server;
  let serverUrl: string;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          assigned: {
            openCount: 2,
            closedCount: 0,
            items: [
              fakeIssue({ id: 1, number: 1, title: '프로젝트10 이슈', projectId: 10 }),
              fakeIssue({ id: 2, number: 2, title: '프로젝트20 이슈', projectId: 20 }),
            ],
          },
        }),
      );
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
  });

  afterEach(async () => {
    sandbox.restore();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('이슈 트리뷰가 프로젝트별로 그룹핑되어 실제 이슈 제목들을 렌더링한다', async () => {
    const showInputBox = sandbox.stub(vscode.window, 'showInputBox');
    showInputBox.onCall(0).resolves(serverUrl);
    showInputBox.onCall(1).resolves('scoped-token');
    sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);
    sandbox.stub(vscode.window, 'showErrorMessage').resolves(undefined);

    await vscode.commands.executeCommand('yona.server.add');
    await vscode.commands.executeCommand('yona.auth.login');

    const extension = vscode.extensions.getExtension('yonaprojects.yonaco');
    const exports = (await extension!.activate()) as { issueTreeProvider: IssueTreeProvider };
    const provider = exports.issueTreeProvider;

    const groupNodes = await provider.getChildren();
    assert.strictEqual(groupNodes.length, 2);

    const projectLabels = groupNodes.map((n) => provider.getTreeItem(n).label);
    assert.deepStrictEqual(projectLabels.sort(), ['프로젝트 #10', '프로젝트 #20']);

    const group10 = groupNodes.find((n) => n.type === 'project' && n.projectId === 10)!;
    const issueNodes: IssueTreeNode[] = await provider.getChildren(group10);
    assert.strictEqual(issueNodes.length, 1);
    const issueItem = provider.getTreeItem(issueNodes[0]);
    assert.strictEqual(issueItem.label, '#1 프로젝트10 이슈');
  });

  it('로그인 전에는 빈 목록을 반환한다', async () => {
    const extension = vscode.extensions.getExtension('yonaprojects.yonaco');
    const exports = (await extension!.activate()) as { issueTreeProvider: IssueTreeProvider };

    assert.deepStrictEqual(await exports.issueTreeProvider.getChildren(), []);
  });
});
