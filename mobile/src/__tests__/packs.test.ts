jest.mock('../db', () => ({ db: null }));
jest.mock('../api', () => ({ getPacks: jest.fn() }));

import { decodeField } from '../packs';

describe('decodeField', () => {
  it('decodes a plain base64 string', () => {
    expect(decodeField(btoa('hello world'))).toBe('hello world');
  });

  it('decodes a string with enc:base64: prefix', () => {
    expect(decodeField(`enc:base64:${btoa('answer A')}`)).toBe('answer A');
  });

  it('decodes UTF-8 multi-byte characters (en-dash, subscripts)', () => {
    // "60–100" contains an en-dash (U+2013), which is 3 bytes in UTF-8
    expect(decodeField('enc:base64:NjDigJMxMDA=')).toBe('60\u2013100');
    // "SpO₂" contains subscript 2 (U+2082)
    expect(decodeField('enc:base64:U3BP4oKC')).toBe('SpO\u2082');
  });
});
