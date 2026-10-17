import { render, screen } from '@testing-library/react-native';
import { Markdown } from './markdown';

describe('markdown', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows headings and emphasis', async () => {
    await render(<Markdown text={'# Soup\n\nCook **slowly**, *gently*.'} />);

    expect(screen.getByRole('header', { name: 'Soup' })).toBeOnTheScreen();
    expect(screen.getByText('Cook slowly, gently.')).toBeOnTheScreen();
    expect(screen.getByText('slowly')).toHaveStyle({ fontWeight: '700' });
    expect(screen.getByText('gently')).toHaveStyle({ fontStyle: 'italic' });
  });

  it('shows bulleted, numbered and task lists; screen readers skip the bullets', async () => {
    await render(<Markdown text={'- Pumpkin\n- Sage\n\n1. Roast\n2. Blend\n\n- [x] Peeled'} />);

    expect(screen.getAllByText('•', { includeHiddenElements: true })).toHaveLength(2);
    expect(screen.queryByText('•')).not.toBeOnTheScreen();
    expect(screen.getByText('2.')).toBeOnTheScreen();
    expect(screen.getByText('☑', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('reads a task as a checkbox, ticked or not', async () => {
    await render(<Markdown text={'- [x] Peeled\n- [ ] Seeded'} />);

    expect(screen.getByRole('checkbox', { checked: true })).toHaveTextContent(/Peeled/);
    expect(screen.getByRole('checkbox', { checked: false })).toHaveTextContent(/Seeded/);
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

  it.each([
    ['a web link', '[the video](https://example.com/soup)', 'the video'],
    ['a script link', '[the video](javascript:alert(1))', 'the video'],
    ['a bare address', 'www.example.com', 'www.example.com'],
    ['a reference link', '[the video][1]\n\n[1]: https://example.com/soup', 'the video'],
  ])('shows %s as plain text, which opens nothing', async (_kind, text, shown) => {
    await render(<Markdown text={text} />);

    expect(screen.getByText(shown)).not.toHaveProp('onPress');
    expect(screen.queryByRole('link')).not.toBeOnTheScreen();
  });

  it('numbers a list from its first number', async () => {
    await render(<Markdown text={'3. Bake\n4. Rest'} />);

    expect(screen.getByText('3.')).toBeOnTheScreen();
    expect(screen.getByText('4.')).toBeOnTheScreen();
  });

  it('shows quotes', async () => {
    await render(<Markdown text={'> Add cream at the end\n\n---\n\nServe.'} />);

    expect(screen.getByText('Add cream at the end')).toBeOnTheScreen();
    expect(screen.getByText('Serve.')).toBeOnTheScreen();
  });

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

  it('shows repeated lines, items and rows, each once', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error');
    await render(
      <Markdown
        text={'Stir.\n\nStir.\n\n- Salt\n- Salt\n\n| A | A |\n|---|---|\n| 1 | 1 |\n| 1 | 1 |'}
      />,
    );

    expect(screen.getAllByText('Stir.')).toHaveLength(2);
    expect(screen.getAllByText('Salt')).toHaveLength(2);
    expect(screen.getAllByText('1')).toHaveLength(4);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('shows text nested too deep to format as typed, without failing', async () => {
    // Deep enough to overflow the parser's stack, then just past the levels drawn.
    await render(<Markdown text={`${'>'.repeat(3000)} Too deep`} />);

    expect(screen.getByText(/Too deep$/)).toBeOnTheScreen();

    await render(<Markdown text={`${'> '.repeat(12)}Still readable`} />);

    expect(screen.getByText(/Still readable$/)).toBeOnTheScreen();
  });

  it('formats the start of a very long text and shows the rest as typed', async () => {
    const start = 'Stir **well**.\n'.repeat(800);
    await render(<Markdown text={`${start}**Last** line`} />);

    expect(screen.getAllByText('well')).not.toHaveLength(0);
    expect(screen.getByText(/\*\*Last\*\* line$/)).toBeOnTheScreen();
  });

  it('shows as typed a list too dense to draw quickly', async () => {
    await render(<Markdown text={'- item\n'.repeat(2000)} />);

    expect(screen.queryByText('•')).not.toBeOnTheScreen();
    expect(screen.getByText(/^- item - item/)).toBeOnTheScreen();
  });

  it('keeps the indentation of the text shown as typed after the formatted start', async () => {
    await render(<Markdown text={`${'x'.repeat(9990)}\n    indented line\nend`} />);

    // Compared as typed: by default, matching collapses spaces and line breaks.
    expect(
      screen.getByText('    indented line\nend', { normalizer: (text) => text }),
    ).toBeOnTheScreen();
  });
});
