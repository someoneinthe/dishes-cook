import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Linking from 'expo-linking';
import { spyOnAlert } from '@/test/alert';
import { Markdown } from './markdown';

jest.mock('expo-linking', () => ({ openURL: jest.fn() }));

describe('markdown', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('shows headings and emphasis', async () => {
    await render(<Markdown text={'# Soup\n\nCook **slowly**, *gently*.'} />);

    expect(screen.getByRole('header', { name: 'Soup' })).toBeOnTheScreen();
    expect(screen.getByText('Cook slowly, gently.')).toBeOnTheScreen();
    expect(screen.getByText('slowly')).toHaveStyle({ fontWeight: '700' });
    expect(screen.getByText('gently')).toHaveStyle({ fontStyle: 'italic' });
  });

  it('shows bulleted, numbered and task lists', async () => {
    await render(<Markdown text={'- Pumpkin\n- Sage\n\n1. Roast\n2. Blend\n\n- [x] Peeled'} />);

    expect(screen.getAllByText('•')).toHaveLength(2);
    expect(screen.getByText('2.')).toBeOnTheScreen();
    expect(screen.getByText('☑')).toBeOnTheScreen();
  });

  it('keeps line breaks as typed', async () => {
    await render(<Markdown text={'Boil the water\nAdd the pasta'} />);

    expect(screen.getByText('Boil the water\nAdd the pasta')).toBeOnTheScreen();
  });

  it('shows raw HTML as typed, without interpreting it', async () => {
    await render(<Markdown text={'<script>alert(1)</script>\n\nA <b>bold</b> move'} />);

    expect(screen.getByText('<script>alert(1)</script>')).toBeOnTheScreen();
    expect(screen.getByText('A <b>bold</b> move')).toBeOnTheScreen();
  });

  it('never loads images, only shows their description', async () => {
    await render(<Markdown text={'![The finished soup](https://example.com/soup.png)'} />);

    expect(screen.getByText('Image: The finished soup')).toBeOnTheScreen();
    expect(JSON.stringify(screen.toJSON())).not.toContain('example.com');
  });

  it('opens a web link after confirming its full address', async () => {
    jest.mocked(Linking.openURL).mockResolvedValue(true);
    const alert = spyOnAlert();
    await render(<Markdown text={'See [the video](https://example.com/soup).'} />);

    await fireEvent.press(screen.getByRole('link', { name: 'the video' }));

    expect(alert.spy).toHaveBeenCalledWith(
      'Open this link?',
      'https://example.com/soup',
      expect.any(Array),
    );
    expect(Linking.openURL).not.toHaveBeenCalled();

    await alert.press('Open');

    expect(Linking.openURL).toHaveBeenCalledWith('https://example.com/soup');
  });

  it('tells when no app can open a link', async () => {
    jest.mocked(Linking.openURL).mockRejectedValue(new Error('No activity'));
    const alert = spyOnAlert();
    await render(<Markdown text={'[Write to me](mailto:chef@example.com)'} />);

    await fireEvent.press(screen.getByRole('link', { name: 'Write to me' }));
    await alert.press('Open');

    expect(alert.spy).toHaveBeenLastCalledWith(
      'Can’t open this link',
      'No app on this phone can open it.',
    );
  });

  it.each(['javascript:alert(1)', 'intent://scan#Intent;end', 'dishescook://recipe/1'])(
    'shows a %s link as plain text',
    async (href) => {
      await render(<Markdown text={`[Click me](${href})`} />);

      expect(screen.getByText('Click me')).toBeOnTheScreen();
      expect(screen.queryByRole('link')).not.toBeOnTheScreen();
    },
  );

  it('shows code and tables', async () => {
    await render(
      <Markdown
        text={'Use `180 °C`.\n\n```\n200 g flour\n```\n\n| Item | Qty |\n|---|---|\n| Egg | 2 |'}
      />,
    );

    expect(screen.getByText('180 °C')).toBeOnTheScreen();
    expect(screen.getByText('200 g flour')).toBeOnTheScreen();
    expect(screen.getByText('Qty')).toBeOnTheScreen();
    expect(screen.getByText('Egg')).toBeOnTheScreen();
  });
});
