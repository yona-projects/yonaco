import * as assert from 'assert';
import * as http from 'http';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import type { YonacoExports } from '../../src/extension';

interface Recorded {
  method?: string;
  url?: string;
  body?: Record<string, unknown>;
}

describe('새 이슈 폼과 프로젝트 등록', () => {
  let sandbox: sinon.SinonSandbox;
  let server: http.Server;
  let serverUrl: string;
  let requests: Recorded[];
  let patchStatus: number;

  const person = { loginId: 'admin', name: '관리자', email: 'admin@example.com' };

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    requests = [];
    patchStatus = 200;
    server = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (chunk) => (raw += chunk));
      req.on('end', () => {
        requests.push({ method: req.method, url: req.url, body: raw ? JSON.parse(raw) : undefined });
        const json = (status: number, body: unknown) => {
          res.writeHead(status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(body));
        };
        const m = /^\/-_-api\/v1\/owners\/([^/]+)\/projects\/([^/]+)(\/.*)?$/.exec(req.url ?? '');
        if (req.url === '/-_-api/v1/user/projects') {
          json(200, {
            projects: [
              { owner: 'owner1', name: 'proj1', overview: '첫째' },
              { owner: 'owner2', name: 'proj2' },
              { owner: 'owner3', name: 'proj3', overview: '셋째' },
            ],
          });
          return;
        }
        if (!m) {
          json(404, {});
          return;
        }
        const [, owner, project, rest = ''] = m;
        if (rest === '/assignableusers') json(200, { users: [{ loginId: 'bob', name: '밥' }, { loginId: 'admin', name: '관리자' }] });
        else if (rest === '/labels') {
          json(200, {
            labels: [
              { id: 4, labelName: 'bug', labelColor: '#d73a4a', category: 'type', isExclusive: true },
              { id: 5, labelName: 'ui', labelColor: '#0075ca', category: 'area', isExclusive: false },
            ],
          });
        } else if (rest.startsWith('/milestones')) json(200, { milestones: [{ id: 3, title: 'v1.0 출시', dueDate: '2026-12-31T23:59:59+0900' }] });
        else if (req.method === 'POST' && rest === '/issues') json(201, [{ status: 201, location: `/${owner}/${project}/issue/7` }]);
        else if (req.method === 'PATCH') json(patchStatus, patchStatus === 200 ? { result: {} } : { message: 'no user by request: nobody' });
        else if (req.method === 'GET' && rest === '/issues/7') {
          json(200, { result: { number: 7, id: 70, title: '만든 이슈', body: '', state: 'OPEN', author: person, owner, projectName: project } });
        } else if (rest.endsWith('/comments')) json(200, { result: [] });
        else json(200, { items: [], page: 1, pageSize: 15, totalPages: 1, totalCount: 0 });
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

    const showInputBox = sandbox.stub(vscode.window, 'showInputBox');
    showInputBox.onCall(0).resolves(serverUrl); // yona.server.add
    showInputBox.onCall(1).resolves('scoped-token'); // yona.auth.login
    sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);
    await vscode.commands.executeCommand('yona.server.add');
    await vscode.commands.executeCommand('yona.auth.login');
    requests = [];
  });

  afterEach(async () => {
    sandbox.restore();
    const exports = (await vscode.extensions.getExtension('yonaprojects.yonaco')!.activate()) as YonacoExports;
    exports.issuePanels.getCreateForm()?.dispose();
    exports.issuePanels.getPanel('owner1', 'proj1', 7)?.dispose();
    exports.issuePanels.getPanel('owner2', 'proj2', 7)?.dispose();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  async function register(...projects: string[]): Promise<YonacoExports> {
    await vscode.workspace.getConfiguration('yona').update('projects', projects, vscode.ConfigurationTarget.Global);
    return (await vscode.extensions.getExtension('yonaprojects.yonaco')!.activate()) as YonacoExports;
  }

  it('프로젝트가 여러 개일 때 프로젝트 항목에서 열면 그 프로젝트가 선택되고 그 프로젝트의 선택지를 읽어 온다', async () => {
    const exports = await register('owner1/proj1', 'owner2/proj2');

    await vscode.commands.executeCommand('yona.issue.create', { type: 'project', owner: 'owner2', name: 'proj2' });
    const form = exports.issuePanels.getCreateForm()!;
    await form.waitUntilLoaded();

    assert.ok(form.html.includes('<option value="owner1/proj1">'), '등록된 프로젝트가 모두 보인다');
    assert.ok(form.html.includes('<option value="owner2/proj2" selected>'), '누른 프로젝트가 선택된다');
    assert.strictEqual(form.options?.project, 'owner2/proj2');
    assert.deepStrictEqual(form.options?.assignees.map((u) => u.loginId), ['bob', 'admin']);
    assert.deepStrictEqual(form.options?.milestones, [{ id: 3, title: 'v1.0 출시', dueDate: '2026-12-31' }]);
    assert.deepStrictEqual(form.options?.labels.map((l) => l.name), ['bug', 'ui']);
    assert.ok(requests.every((r) => !r.url?.includes('owner1')), '다른 프로젝트의 선택지는 읽지 않는다');
  });

  it('제목줄에서 열면 프로젝트를 고르지 않은 채 열리고, 고르기 전에는 만들 수 없다', async () => {
    const exports = await register('owner1/proj1', 'owner2/proj2');

    await vscode.commands.executeCommand('yona.issue.create');
    const form = exports.issuePanels.getCreateForm()!;

    assert.ok(form.html.includes('프로젝트를 선택하세요'));
    assert.strictEqual(form.options, undefined, '프로젝트를 고르기 전에는 선택지를 읽지 않는다');
    await form.handleMessage({ type: 'submit', project: '', title: '제목', body: '', assignee: '', milestoneId: null, dueDate: '', labelIds: [] });
    assert.strictEqual(form.lastError, '프로젝트를 선택하세요.');
    assert.strictEqual(requests.filter((r) => r.method === 'POST').length, 0);
  });

  it('웹뷰에서 프로젝트를 바꾸면 그 프로젝트의 선택지를 새로 읽는다', async () => {
    const exports = await register('owner1/proj1', 'owner2/proj2');
    await vscode.commands.executeCommand('yona.issue.create', { type: 'project', owner: 'owner1', name: 'proj1' });
    const form = exports.issuePanels.getCreateForm()!;
    await form.waitUntilLoaded();

    await form.handleMessage({ type: 'loadOptions', project: 'owner2/proj2' });

    assert.strictEqual(form.options?.project, 'owner2/proj2');
    assert.ok(requests.some((r) => r.url === '/-_-api/v1/owners/owner2/projects/proj2/labels'));
  });

  it('프로젝트가 하나뿐이면 자동으로 선택되고 고르는 칸은 잠긴다', async () => {
    const exports = await register('owner1/proj1');

    await vscode.commands.executeCommand('yona.issue.create');
    const form = exports.issuePanels.getCreateForm()!;
    await form.waitUntilLoaded();

    assert.ok(form.html.includes('<option value="owner1/proj1" selected>'));
    assert.ok(form.html.includes('id="project" disabled'));
    assert.strictEqual(form.options?.project, 'owner1/proj1');
  });

  it('모든 항목을 채워 만들면 POST 뒤 PATCH로 담당자, 마일스톤, 라벨을 붙이고 폼을 닫고 이슈 상세를 연다', async () => {
    const exports = await register('owner1/proj1', 'owner2/proj2');
    const refresh = sandbox.spy(exports.issueTreeProvider, 'refresh');
    await vscode.commands.executeCommand('yona.issue.create', { type: 'project', owner: 'owner2', name: 'proj2' });
    const form = exports.issuePanels.getCreateForm()!;
    await form.waitUntilLoaded();
    requests = [];

    await form.handleMessage({
      type: 'submit', project: 'owner2/proj2', title: '  결제 오류  ', body: '본문입니다', assignee: 'bob', milestoneId: 3, dueDate: '2026-11-20', labelIds: [4, 5],
    });

    const post = requests.find((r) => r.method === 'POST')!;
    assert.strictEqual(post.url, '/-_-api/v1/owners/owner2/projects/proj2/issues');
    const sent = (post.body as { issues: Array<{ title: string; body: string; dueDate: string }> }).issues[0];
    assert.strictEqual(sent.title, '결제 오류', '제목의 앞뒤 공백은 뗀다');
    assert.strictEqual(sent.body, '본문입니다');
    assert.ok(sent.dueDate.startsWith('2026-11-20T23:59:59'));
    const patch = requests.find((r) => r.method === 'PATCH')!;
    assert.strictEqual(patch.url, '/-_-api/v1/owners/owner2/projects/proj2/issues/7');
    assert.deepStrictEqual(patch.body, { assignees: ['bob'], milestone: 3, labels: [4, 5] });
    assert.strictEqual(exports.issuePanels.getCreateForm(), undefined, '만들면 폼이 닫힌다');
    assert.ok(refresh.called, '트리가 새로고침된다');
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.ok(exports.issuePanels.getPanel('owner2', 'proj2', 7), '만든 이슈의 상세가 열린다');
  });

  it('제목이 비어 있으면 서버에 요청하지 않고 폼에 안내한다', async () => {
    const exports = await register('owner1/proj1');
    await vscode.commands.executeCommand('yona.issue.create');
    const form = exports.issuePanels.getCreateForm()!;
    await form.waitUntilLoaded();
    requests = [];

    await form.handleMessage({ type: 'submit', project: 'owner1/proj1', title: '   ', body: '', assignee: '', milestoneId: null, dueDate: '', labelIds: [] });

    assert.strictEqual(form.lastError, '제목을 입력하세요.');
    assert.strictEqual(requests.length, 0);
    assert.ok(exports.issuePanels.getCreateForm(), '폼은 열려 있다');
  });

  it('이슈는 만들었지만 PATCH가 실패하면 경고하고 폼을 닫아 같은 이슈를 다시 만들지 않게 한다', async () => {
    const exports = await register('owner1/proj1');
    const warn = sandbox.stub(vscode.window, 'showWarningMessage').resolves(undefined);
    await vscode.commands.executeCommand('yona.issue.create');
    const form = exports.issuePanels.getCreateForm()!;
    await form.waitUntilLoaded();
    patchStatus = 400;

    await form.handleMessage({ type: 'submit', project: 'owner1/proj1', title: '제목', body: '', assignee: 'nobody', milestoneId: null, dueDate: '', labelIds: [] });

    assert.ok(warn.calledWithMatch(sinon.match(/#7은 만들었지만/)));
    assert.strictEqual(exports.issuePanels.getCreateForm(), undefined);
  });

  it('줄에서 이슈 만들기는 본문에 파일경로:줄번호를 채운 폼을 연다', async () => {
    const exports = await register('owner1/proj1', 'owner2/proj2');
    const doc = await vscode.workspace.openTextDocument({ content: 'line1\nline2\nline3\n' });
    const editor = await vscode.window.showTextDocument(doc);
    editor.selection = new vscode.Selection(2, 0, 2, 0);
    const expected = `${vscode.workspace.asRelativePath(doc.uri)}:3`;

    await vscode.commands.executeCommand('yona.issue.createFromLine');
    const form = exports.issuePanels.getCreateForm()!;

    assert.ok(form.html.includes(`>${expected}</textarea>`), `본문 입력칸에 ${expected}가 채워져야 한다`);
    assert.ok(form.html.includes('프로젝트를 선택하세요'), '프로젝트가 여러 개면 고르게 한다');
  });

  it('프로젝트가 하나도 등록되지 않았으면 안내만 하고 폼을 열지 않는다', async () => {
    const exports = await register();
    const showError = sandbox.stub(vscode.window, 'showErrorMessage').resolves(undefined);

    await vscode.commands.executeCommand('yona.issue.create');

    assert.ok(showError.calledWithMatch(sinon.match(/프로젝트를 등록/)));
    assert.strictEqual(exports.issuePanels.getCreateForm(), undefined);
  });

  it('프로젝트 등록은 내가 속한 프로젝트 중 아직 등록하지 않은 것을 여러 개 고르게 한다', async () => {
    const exports = await register('owner1/proj1');
    const quickPick = sandbox.stub(vscode.window, 'showQuickPick') as unknown as sinon.SinonStub;
    quickPick.callsFake(async (items: Array<{ label: string }>) => items.filter((i) => i.label === 'owner2/proj2' || i.label === 'owner3/proj3'));

    await vscode.commands.executeCommand('yona.project.add');

    const offered = (quickPick.firstCall.args[0] as Array<{ label: string }>).map((i) => i.label);
    assert.deepStrictEqual(offered, ['owner2/proj2', 'owner3/proj3', '$(edit) 직접 입력...'], '이미 등록한 프로젝트는 보이지 않는다');
    assert.deepStrictEqual(exports.projectRegistry.list().map((p) => `${p.owner}/${p.name}`), ['owner1/proj1', 'owner2/proj2', 'owner3/proj3']);
  });
});
