import * as assert from 'assert';
import { describeSetupState } from '../../../src/ui/setupState';

describe('describeSetupState', () => {
  it('서버가 없으면 서버 등록 단계이다', () => {
    assert.deepStrictEqual(describeSetupState({ currentServer: undefined, hasToken: false, projectCount: 0 }), {
      hasServer: false,
      hasToken: false,
      hasProject: false,
    });
  });

  it('서버만 있고 토큰이 없으면 로그인 단계이다', () => {
    const state = describeSetupState({ currentServer: 'https://a', hasToken: false, projectCount: 2 });
    assert.strictEqual(state.hasServer, true);
    assert.strictEqual(state.hasToken, false);
  });

  it('서버와 토큰이 있고 프로젝트가 없으면 프로젝트 등록 단계이다', () => {
    assert.deepStrictEqual(describeSetupState({ currentServer: 'https://a', hasToken: true, projectCount: 0 }), {
      hasServer: true,
      hasToken: true,
      hasProject: false,
    });
  });

  it('모두 갖추면 세 값이 모두 참이다', () => {
    assert.deepStrictEqual(describeSetupState({ currentServer: 'https://a', hasToken: true, projectCount: 1 }), {
      hasServer: true,
      hasToken: true,
      hasProject: true,
    });
  });
});
