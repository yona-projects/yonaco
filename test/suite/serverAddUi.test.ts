import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';

describe('서버 추가 UI', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    const config = vscode.workspace.getConfiguration('yona');
    await config.update('servers', [], vscode.ConfigurationTarget.Global);
    await config.update('currentServer', undefined, vscode.ConfigurationTarget.Global);
    sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);
    sandbox.stub(vscode.window, 'showErrorMessage').resolves(undefined);
  });

  afterEach(() => sandbox.restore());

  it('서버가 하나도 없을 때 서버 전환 명령을 실행하면 선택창 없이 주소 입력창이 열리고, 입력한 서버가 등록되어 선택된다', async () => {
    const showQuickPick = sandbox.stub(vscode.window, 'showQuickPick');
    const showInputBox = sandbox.stub(vscode.window, 'showInputBox').resolves('http://127.0.0.1:9/yona/');

    await vscode.commands.executeCommand('yona.server.switch');

    assert.strictEqual(showQuickPick.called, false);
    const options = showInputBox.firstCall.args[0];
    assert.ok(options?.validateInput, '입력창에 주소 검사 함수가 붙어야 한다');
    assert.ok(options!.validateInput!('yona.example.com'), '형식이 틀리면 안내가 나온다');
    assert.strictEqual(options!.validateInput!('http://127.0.0.1:9'), undefined);
    const config = vscode.workspace.getConfiguration('yona');
    assert.deepStrictEqual(config.get('servers'), ['http://127.0.0.1:9/yona']);
    assert.strictEqual(config.get('currentServer'), 'http://127.0.0.1:9/yona');
  });

  it('서버가 있을 때 선택 목록의 "서버 추가..."를 고르면 새 서버가 등록되고 그 서버로 전환된다', async () => {
    const config = vscode.workspace.getConfiguration('yona');
    await config.update('servers', ['http://127.0.0.1:1'], vscode.ConfigurationTarget.Global);
    await config.update('currentServer', 'http://127.0.0.1:1', vscode.ConfigurationTarget.Global);
    const showQuickPick = sandbox.stub(vscode.window, 'showQuickPick') as unknown as sinon.SinonStub;
    showQuickPick.callsFake(async (items: string[]) => items[items.length - 1]);
    sandbox.stub(vscode.window, 'showInputBox').resolves('http://127.0.0.1:2');

    await vscode.commands.executeCommand('yona.server.switch');

    const offered = showQuickPick.firstCall.args[0] as string[];
    assert.deepStrictEqual(offered, ['http://127.0.0.1:1', '$(add) 서버 추가...']);
    const after = vscode.workspace.getConfiguration('yona');
    assert.deepStrictEqual(after.get('servers'), ['http://127.0.0.1:1', 'http://127.0.0.1:2']);
    assert.strictEqual(after.get('currentServer'), 'http://127.0.0.1:2');
  });

  it('토큰 입력을 취소하면 오류 없이 끝나고, 서버가 없을 때만 서버 등록을 안내한다', async () => {
    const config = vscode.workspace.getConfiguration('yona');
    await config.update('servers', ['http://127.0.0.1:1'], vscode.ConfigurationTarget.Global);
    await config.update('currentServer', 'http://127.0.0.1:1', vscode.ConfigurationTarget.Global);
    const showErrorMessage = vscode.window.showErrorMessage as unknown as sinon.SinonStub;
    sandbox.stub(vscode.window, 'showInputBox').resolves(undefined); // 토큰 입력 취소

    await vscode.commands.executeCommand('yona.auth.login');

    assert.strictEqual(showErrorMessage.called, false, '취소는 오류가 아니다');

    await config.update('currentServer', undefined, vscode.ConfigurationTarget.Global);
    await vscode.commands.executeCommand('yona.auth.login');
    assert.ok(showErrorMessage.calledWithMatch(sinon.match(/서버를 등록/)), '서버가 없으면 안내한다');
  });
});
