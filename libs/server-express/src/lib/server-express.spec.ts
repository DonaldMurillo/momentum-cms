import { serverExpress } from './server-express';

describe('serverExpress', () => {
  it('should work', () => {
    expect(serverExpress()).toEqual('server-express');
  });
});
