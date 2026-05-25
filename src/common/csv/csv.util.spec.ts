import {
  buildCsv,
  escapeCsvCell,
  parseContentDispositionFilename,
} from './csv.util';

describe('csv.util', () => {
  it('escapeCsvCell quotes fields with comma or newline', () => {
    expect(escapeCsvCell('plain')).toBe('plain');
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell(null)).toBe('');
  });

  it('buildCsv joins header and rows', () => {
    const csv = buildCsv(
      ['id', 'name'],
      [
        ['1', 'Alice'],
        ['2', 'Bob, Jr'],
      ],
    );
    expect(csv).toBe('id,name\r\n1,Alice\r\n2,"Bob, Jr"');
  });

  it('parseContentDispositionFilename reads quoted filename', () => {
    expect(
      parseContentDispositionFilename(
        'attachment; filename="transactions-2026-05-25.csv"',
        'fallback.csv',
      ),
    ).toBe('transactions-2026-05-25.csv');
  });
});
