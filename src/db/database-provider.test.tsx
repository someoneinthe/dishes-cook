import { render, screen } from '@testing-library/react-native';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { Text } from 'react-native';
import { useDatabase } from './database-context';
import { DatabaseProvider } from './database-provider';

jest.mock('./client', () => ({
  createAppConnection: (database: unknown) => ({ db: database, subscribe: () => () => {} }),
  openAppDatabase: () => ({ name: 'app database' }),
}));
jest.mock('drizzle-orm/expo-sqlite/migrator', () => ({ useMigrations: jest.fn() }));

function DatabaseName() {
  const database = useDatabase() as unknown as { name: string };
  return <Text>{database.name}</Text>;
}

describe('databaseProvider', () => {
  const renderProvider = () =>
    render(
      <DatabaseProvider>
        <DatabaseName />
      </DatabaseProvider>,
    );

  it('renders nothing while migrating', async () => {
    jest.mocked(useMigrations).mockReturnValue({ error: undefined, success: false });

    await renderProvider();

    expect(screen.toJSON()).toBeNull();
  });

  it('provides the database once migrated', async () => {
    jest.mocked(useMigrations).mockReturnValue({ error: undefined, success: true });

    await renderProvider();

    expect(screen.getByText('app database')).toBeOnTheScreen();
  });

  it('tells when the database cannot be opened', async () => {
    jest.mocked(useMigrations).mockReturnValue({ error: new Error('disk full'), success: false });

    await renderProvider();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The recipes database could not be opened: disk full',
    );
  });
});
