import {defaultOption, parseOption} from '../option';

describe('parseOption()', () => {
  it('empty rc option and comment option', () => {
    expect(parseOption({}, {})).toStrictEqual(defaultOption);
  });

  it('give rc option, empty comment option', () => {
    expect(
      parseOption(
        {
          src: 'https://example.com/templates/',
        },
        {},
      ),
    ).toStrictEqual({
      src: 'https://example.com/templates/',
    });
  });

  it('give rc option and comment option', () => {
    expect(
      parseOption(
        {
          src: 'https://1.example.com/templates/',
        },
        {
          src: 'https://2.example.com/templates/',
        },
      ),
    ).toStrictEqual({
      src: 'https://2.example.com/templates/',
    });
  });
});
