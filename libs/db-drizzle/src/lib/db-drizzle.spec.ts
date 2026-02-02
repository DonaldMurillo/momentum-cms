import { dbDrizzle } from './db-drizzle';

describe('dbDrizzle', () => {
  it('should work', () => {
    expect(dbDrizzle()).toEqual('db-drizzle');
  });
});
