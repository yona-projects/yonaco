import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';

describe('0.0.2 레거시 전권 토큰 등록', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    const config = vscode.workspace.getConfiguration('yona');
    await config.update('servers', [], vscode.ConfigurationTarget.Global);
    await config.update('currentServer', undefined, vscode.ConfigurationTarget.Global);

    const extension = vscode.extensions.getExtension('yonaprojects.yonaco');
    const exports = (await extension!.activate()) as {
      tokenStore: { deleteToken(url: string, kind: string): Promise<void> };
    };
    await exports.tokenStore.deleteToken('https://yona.example.com', 'legacy');
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('서버 등록 후 yona.auth.loginLegacy를 실행하면 legacy 슬롯에 토큰이 저장되고 yona.hasLegacyToken 컨텍스트가 true로 설정된다', async () => {
    const extension = vscode.extensions.getExtension('yonaprojects.yonaco');
    assert.ok(extension, '익스텐션을 찾을 수 없습니다');
    const exports = (await extension!.activate()) as {
      tokenStore: { getToken(url: string, kind: string): Promise<string | undefined> };
    };

    const showInputBox = sandbox.stub(vscode.window, 'showInputBox');
    showInputBox.onCall(0).resolves('https://yona.example.com'); // yona.server.add
    showInputBox.onCall(1).resolves('legacy-full-scope-token'); // yona.auth.loginLegacy
    sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);
    sandbox.stub(vscode.window, 'showErrorMessage').resolves(undefined);
    const executeCommandSpy = sandbox.spy(vscode.commands, 'executeCommand');

    await vscode.commands.executeCommand('yona.server.add');
    await vscode.commands.executeCommand('yona.auth.loginLegacy');

    assert.strictEqual(
      await exports.tokenStore.getToken('https://yona.example.com', 'legacy'),
      'legacy-full-scope-token',
    );
    assert.ok(
      executeCommandSpy.calledWith('setContext', 'yona.hasLegacyToken', true),
      `setContext 호출이 있어야 한다. 실제 호출: ${JSON.stringify(executeCommandSpy.args)}`,
    );
  });

  it('서버가 등록되지 않은 상태로 실행하면 에러 메시지를 보여주고 아무것도 저장하지 않는다', async () => {
    const extension = vscode.extensions.getExtension('yonaprojects.yonaco');
    const exports = (await extension!.activate()) as {
      tokenStore: { getToken(url: string, kind: string): Promise<string | undefined> };
    };
    sandbox.stub(vscode.window, 'showInputBox').resolves('should-not-be-used');
    const showErrorMessage = sandbox.stub(vscode.window, 'showErrorMessage').resolves(undefined);

    await vscode.commands.executeCommand('yona.auth.loginLegacy');

    assert.ok(showErrorMessage.called);
    assert.strictEqual(await exports.tokenStore.getToken('https://yona.example.com', 'legacy'), undefined);
  });
});
