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
});
