import { createSQLiteWriteCoordinator } from '@/database/sqliteDatabase';

describe('SQLite write coordinator', () => {
  it('serializes writes and continues after a failed operation', async () => {
    const coordinateWrite = createSQLiteWriteCoordinator();

    const events: string[] = [];
    let releaseFirstWrite!: () => void;
    let markFirstWriteStarted!: () => void;
    const firstWriteCanFinish = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve;
    });
    const firstWriteStarted = new Promise<void>((resolve) => {
      markFirstWriteStarted = resolve;
    });

    const firstWrite = coordinateWrite(async () => {
      events.push('first:start');
      markFirstWriteStarted();
      await firstWriteCanFinish;
      events.push('first:end');
    });

    await firstWriteStarted;

    const secondWrite = coordinateWrite(async () => {
      events.push('second');
    });

    await Promise.resolve();
    expect(events).toEqual(['first:start']);

    releaseFirstWrite();
    await Promise.all([firstWrite, secondWrite]);
    expect(events).toEqual(['first:start', 'first:end', 'second']);

    await expect(
      coordinateWrite(async () => {
        throw new Error('write failed');
      })
    ).rejects.toThrow('write failed');

    await expect(
      coordinateWrite(async () => 'next write succeeded')
    ).resolves.toBe('next write succeeded');
  });
});
