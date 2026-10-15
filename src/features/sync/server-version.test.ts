import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { checkServerVersion, SERVER_MIGRATION_LIST, SYNC_VERSION } from './server-version';

const SERVER = path.join(__dirname, '../../../server');
const POCKETBASE_MIGRATION_LIST = ['1640988000_init.go', '1717233556_v0.23_migrate.go'];

describe('server version', () => {
  describe('checkServerVersion', () => {
    const upToDateList = [...POCKETBASE_MIGRATION_LIST, ...SERVER_MIGRATION_LIST];

    it('matches a server with every migration this app knows', () => {
      expect(
        checkServerVersion({ migrations: upToDateList, minimumAppSyncVersion: SYNC_VERSION }),
      ).toBe('compatible');
    });

    it('finds a server without the version endpoint too old', () => {
      expect(checkServerVersion(undefined)).toBe('server-outdated');
    });

    it('finds a server without the last migration this app needs too old', () => {
      expect(
        checkServerVersion({
          migrations: [...POCKETBASE_MIGRATION_LIST, ...SERVER_MIGRATION_LIST.slice(0, -1)],
          minimumAppSyncVersion: SYNC_VERSION,
        }),
      ).toBe('server-outdated');
    });

    it('finds this app too old for a server that asks for a newer one', () => {
      expect(
        checkServerVersion({ migrations: upToDateList, minimumAppSyncVersion: SYNC_VERSION + 1 }),
      ).toBe('app-outdated');
    });

    it('notices a server with migrations this app does not know', () => {
      expect(
        checkServerVersion({
          migrations: [...upToDateList, '9999999999-from-a-newer-app.js'],
          minimumAppSyncVersion: SYNC_VERSION,
        }),
      ).toBe('newer-server');
    });
  });

  describe('versions kept in step with the server files', () => {
    it('knows every server migration, in order', () => {
      const fileList = readdirSync(path.join(SERVER, 'migrations'))
        .filter((name) => name.endsWith('.js'))
        .sort((a, b) => a.localeCompare(b));

      expect(SERVER_MIGRATION_LIST).toStrictEqual(fileList);
    });

    it("never asks for a newer app than this one (it couldn't sync with its own server)", () => {
      const hook = readFileSync(path.join(SERVER, 'hooks/server-info.pb.js'), 'utf8');
      const minimum = Number(/MINIMUM_APP_SYNC_VERSION = (\d+);/.exec(hook)?.[1]);

      expect(minimum).toBeGreaterThanOrEqual(1);
      expect(minimum).toBeLessThanOrEqual(SYNC_VERSION);
    });
  });
});
