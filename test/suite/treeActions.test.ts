import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import type { YonacoExports } from '../../src/extension';

describe('트리 항목 동작', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    const config = vscode.workspace.getConfiguration('yona');
    await config.update('servers', ['https://yona.example.com'], vscode.ConfigurationTarget.Global);
    await config.update('currentServer', 'https://yona.example.com', vscode.ConfigurationTarget.Global);
    await config.update('projects', ['owner1/proj1', 'owner2/proj2'], vscode.ConfigurationTarget.Global);
    sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);
    sandbox.stub(vscode.window, 'showErrorMessage').resolves(undefined);
    await vscode.extensions.getExtension('yonaprojects.yonaco')!.activate();
  });

  afterEach(() => sandbox.restore());

  it('이슈 항목의 "브라우저에서 열기"는 서버의 이슈 화면 주소를 연다', async () => {
    const openExternal = sandbox.stub(vscode.env, 'openExternal').resolves(true);
    const node = { type: 'issue', owner: 'owner1', name: 'proj1', issue: { id: 1, number: 12, title: 't', state: 'OPEN', authorLoginId: 'a', numOfComments: 0 } };

    await vscode.commands.executeCommand('yona.openInBrowser', node);

    assert.strictEqual(openExternal.firstCall.args[0].toString(), 'https://yona.example.com/owner1/proj1/issue/12');
  });

  it('프로젝트 항목의 "브라우저에서 열기"는 프로젝트 화면 주소를 연다', async () => {
    const openExternal = sandbox.stub(vscode.env, 'openExternal').resolves(true);

    await vscode.commands.executeCommand('yona.openInBrowser', { type: 'project', owner: 'owner1', name: 'proj1' });

    assert.strictEqual(openExternal.firstCall.args[0].toString(), 'https://yona.example.com/owner1/proj1');
  });

  it('프로젝트 항목의 "제거"는 등록 목록에서 그 프로젝트만 뺀다', async () => {
    const exports = (await vscode.extensions.getExtension('yonaprojects.yonaco')!.activate()) as YonacoExports;

    await vscode.commands.executeCommand('yona.project.remove', { type: 'project', owner: 'owner1', name: 'proj1' });

    assert.deepStrictEqual(exports.projectRegistry.list(), [{ owner: 'owner2', name: 'proj2' }]);
  });

  it('프로젝트가 아닌 항목에는 제거가 아무것도 하지 않는다', async () => {
    const exports = (await vscode.extensions.getExtension('yonaprojects.yonaco')!.activate()) as YonacoExports;

    await vscode.commands.executeCommand('yona.project.remove', { type: 'empty', owner: 'owner1', name: 'proj1' });

    assert.strictEqual(exports.projectRegistry.list().length, 2);
  });
});
