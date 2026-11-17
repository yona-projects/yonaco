import * as assert from 'assert';
import { labelTextColor, safeColor } from '../../../src/webview/labelColor';

describe('labelTextColor', () => {
  it('밝은 배경에는 어두운 글자, 어두운 배경에는 밝은 글자를 고른다', () => {
    assert.strictEqual(labelTextColor('#ffffff'), '#000000');
    assert.strictEqual(labelTextColor('#fbca04'), '#000000');
    assert.strictEqual(labelTextColor('#000000'), '#ffffff');
    assert.strictEqual(labelTextColor('#d73a4a'), '#ffffff');
  });

  it('3자리 약식 색도 읽는다', () => {
    assert.strictEqual(labelTextColor('#fff'), '#000000');
  });
});

describe('safeColor', () => {
  it('#과 16진수 3자리나 6자리만 그대로 돌려준다', () => {
    assert.strictEqual(safeColor('#d73a4a'), '#d73a4a');
    assert.strictEqual(safeColor('#FFF'), '#FFF');
  });

  it('그 밖의 값은 기본 회색으로 바꿔 스타일 주입을 막는다', () => {
    assert.strictEqual(safeColor('red; background:url(x)'), '#888888');
    assert.strictEqual(safeColor(''), '#888888');
    assert.strictEqual(safeColor('#12345'), '#888888');
  });
});
