import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import * as fs from 'fs';
import path from 'path';
import url from 'url';
import {promisify} from 'util';
import {parse} from '..';
import {defaultOption} from '../option';
import {
  analyzeBlocks,
  createTemplateURL,
  fetchTemplate,
  isTemplateComment,
  joinBlocks,
  parseComment,
  separateBlocks,
} from '../parse';

const fixturesPath = path.resolve(__dirname, 'fixtures');
const templatesPath = path.resolve(fixturesPath, 'templates');

const axiosMock = new MockAdapter(axios);
const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);

describe('isTemplateComment()', () => {
  it('return true', () => {
    expect(isTemplateComment('# ignoregen env')).toBe(true);
    expect(
      isTemplateComment(
        `# ignoregen env {"src": "https://example.com/ignores/"}`,
      ),
    ).toBe(true);
  });

  it('return false', () => {
    expect(isTemplateComment('#ignoregen node')).toBe(false);
    expect(isTemplateComment('# ignoregen')).toBe(false);
  });
});

describe('separateBlocks()', () => {
  it('empty line', () => {
    const actual = separateBlocks(['']);
    const expected = [''];
    expect(actual).toStrictEqual(expected);
  });

  it('no template', () => {
    const actual = separateBlocks(['dist/', 'lib/', '']);
    const expected = ['dist/', 'lib/', ''];
    expect(actual).toStrictEqual(expected);
  });

  it('with only template', () => {
    const actual = separateBlocks([
      '# ignoregen env',
      '.env*',
      '.envrc',
      '!.env.example',
      '',
    ]);
    const expected = [
      {
        comment: '# ignoregen env',
        content: ['.env*', '.envrc', '!.env.example'],
      },
    ];
    expect(actual).toStrictEqual(expected);
  });

  it('with multiple template', () => {
    const actual = separateBlocks([
      '# ignoregen env',
      '.env*',
      '.envrc',
      '!.env.example',
      '',
      '# ignoregen node',
      'node_modules/',
      '',
    ]);
    const expected = [
      {
        comment: '# ignoregen env',
        content: ['.env*', '.envrc', '!.env.example'],
      },
      {
        comment: '# ignoregen node',
        content: ['node_modules/'],
      },
    ];
    expect(actual).toStrictEqual(expected);
  });

  it('complexed', () => {
    const actual = separateBlocks([
      '.vscode/',
      '# ignoregen env',
      '.env*',
      '.envrc',
      '!.env.example',
      '',
      'dist/',
      'lib/',
      '',
    ]);
    const expected = [
      '.vscode/',
      {
        comment: '# ignoregen env',
        content: ['.env*', '.envrc', '!.env.example'],
      },
      'dist/',
      'lib/',
      '',
    ];
    expect(actual).toStrictEqual(expected);
  });
});

describe('joinBlocks()', () => {
  it('no template', () => {
    const actual = joinBlocks(['dist/', 'lib/', '']);
    const expected = ['dist/', 'lib/', ''];
    expect(actual).toStrictEqual(expected);
  });

  it('with only template', () => {
    const actual = joinBlocks([
      {
        comment: '# ignoregen env',
        content: ['.env*', '.envrc', '!.env.example'],
      },
    ]);
    const expected = [
      '# ignoregen env',
      '.env*',
      '.envrc',
      '!.env.example',
      '',
    ];
    expect(actual).toStrictEqual(expected);
  });

  it('with multiple templates', () => {
    const actual = joinBlocks([
      {
        comment: '# ignoregen env',
        content: ['.env*', '.envrc', '!.env.example'],
      },
      {
        comment: '# ignoregen node',
        content: ['node_modules/'],
      },
    ]);
    const expected = [
      '# ignoregen env',
      '.env*',
      '.envrc',
      '!.env.example',
      '',
      '# ignoregen node',
      'node_modules/',
      '',
    ];
    expect(actual).toStrictEqual(expected);
  });

  it('complexed', () => {
    const actual = joinBlocks([
      '.vscode/',
      {
        comment: '# ignoregen env',
        content: ['.env*', '.envrc', '!.env.example'],
      },
      'dist/',
      'lib/',
      '',
    ]);
    const expected = [
      '.vscode/',
      '# ignoregen env',
      '.env*',
      '.envrc',
      '!.env.example',
      '',
      'dist/',
      'lib/',
      '',
    ];
    expect(actual).toStrictEqual(expected);
  });

  it('throw errors', () => {
    const given = joinBlocks([
      {
        comment: '# ignoregen ?',
        content: ['?'],
        error: `Failed to fetch template from "https://raw.githubusercontent.com/SnO2WMaN-HQ/ignoregen-template/master/templates/?.ignore" for "# ignoregen ?"`,
      },
      {
        comment: '# ignoregen !',
        content: ['!'],
        error: `Failed to fetch template from "https://raw.githubusercontent.com/SnO2WMaN-HQ/ignoregen-template/master/templates/!.ignore" for "# ignoregen !"`,
      },
    ]);
    expect(given).toStrictEqual([
      new Error(
        `Failed to fetch template from "https://raw.githubusercontent.com/SnO2WMaN-HQ/ignoregen-template/master/templates/?.ignore" for "# ignoregen ?"`,
      ),
      new Error(
        `Failed to fetch template from "https://raw.githubusercontent.com/SnO2WMaN-HQ/ignoregen-template/master/templates/!.ignore" for "# ignoregen !"`,
      ),
    ]);
  });
});

describe('analyzeBlocks()', () => {
  describe('empty rc option', () => {
    it('no template', async () => {
      const actual = await analyzeBlocks(['dist/', 'lib/', ''], {});
      const expected = ['dist/', 'lib/', ''];
      expect(actual).toStrictEqual(expected);
    });

    describe('axios mocked for local fixture', () => {
      beforeEach(async () => {
        const dirents = await (
          await readdir(templatesPath, {withFileTypes: true})
        ).filter((dirent) => dirent.isFile());

        for (const {name} of dirents) {
          const content = await readFile(path.resolve(templatesPath, name), {
            encoding: 'utf-8',
          });

          axiosMock.onGet(`${defaultOption.src}${name}`).reply((config) => {
            return [200, content];
          });
        }
      });

      afterEach(() => {
        axiosMock.reset();
      });

      it('with only template', async () => {
        const actual = await analyzeBlocks(
          [
            {
              comment: '# ignoregen env',
              content: ['.env*'],
            },
          ],
          {},
        );
        const expected = [
          {
            comment: '# ignoregen env',
            content: ['.env*', '.envrc', '!.env.example'],
          },
        ];
        expect(actual).toStrictEqual(expected);
      });

      it('not-exist template', async () => {
        const actual = await analyzeBlocks(
          [
            {
              comment: '# ignoregen ?',
              content: ['?'],
            },
          ],
          {},
        );
        const expected = [
          {
            comment: '# ignoregen ?',
            content: ['?'],
            error: `Failed to fetch template from "https://raw.githubusercontent.com/SnO2WMaN-HQ/ignoregen-template/master/templates/?.ignore" for "# ignoregen ?"`,
          },
        ];
        expect(actual).toStrictEqual(expected);
      });

      it('not-exist templates', async () => {
        const actual = await analyzeBlocks(
          [
            {
              comment: '# ignoregen ?',
              content: ['?'],
            },
            {
              comment: '# ignoregen !',
              content: ['!'],
            },
          ],
          {},
        );
        const expected = [
          {
            comment: '# ignoregen ?',
            content: ['?'],
            error: `Failed to fetch template from "https://raw.githubusercontent.com/SnO2WMaN-HQ/ignoregen-template/master/templates/?.ignore" for "# ignoregen ?"`,
          },
          {
            comment: '# ignoregen !',
            content: ['!'],
            error: `Failed to fetch template from "https://raw.githubusercontent.com/SnO2WMaN-HQ/ignoregen-template/master/templates/!.ignore" for "# ignoregen !"`,
          },
        ];
        expect(actual).toStrictEqual(expected);
      });
    });
  });
});

describe('parseComment()', () => {
  describe('empty rc option', () => {
    it('no option', () => {
      const actual = parseComment('# ignoregen env', {});
      expect(actual).toStrictEqual({
        name: 'env',
        option: {src: defaultOption.src},
      });
    });

    it('empty option', () => {
      const actual = parseComment('# ignoregen env {}', {});
      expect(actual).toStrictEqual({
        name: 'env',
        option: {src: defaultOption.src},
      });
    });

    it('src override', () => {
      const actual = parseComment(
        '# ignoregen env {"src": "https://example.com/ignores/"}',
        {},
      );
      expect(actual).toStrictEqual({
        name: 'env',
        option: {src: 'https://example.com/ignores/'},
      });
    });
  });
});

describe('createTemplateURL()', () => {
  it('create template url', () => {
    expect(
      createTemplateURL({
        name: 'env',
        option: {src: 'https://example.com/ignores/'},
      }),
    ).toBe('https://example.com/ignores/env.ignore');
  });
});

describe('fetchTemplate()', () => {
  describe('axios mocked for local fixture', () => {
    beforeEach(async () => {
      const dirents = await (
        await readdir(templatesPath, {withFileTypes: true})
      ).filter((dirent) => dirent.isFile());

      for (const {name} of dirents) {
        const content = await readFile(path.resolve(templatesPath, name), {
          encoding: 'utf-8',
        });

        axiosMock.onGet(`${defaultOption.src}${name}`).reply((config) => {
          return [200, content];
        });
      }
    });

    afterEach(() => {
      axiosMock.reset();
    });

    it('fetch success', async () => {
      const actual = await fetchTemplate(
        url.resolve(defaultOption.src, 'env.ignore'),
      );
      expect(actual).toStrictEqual(['.env*', '.envrc', '!.env.example']);
    });

    it('fetch not-exist template', async () => {
      await expect(async () => {
        await fetchTemplate(url.resolve(defaultOption.src, '?.ignore'));
      }).rejects.toThrow(`404`);
    });
  });

  afterEach(() => {
    axiosMock.reset();
  });

  it.each([[400], [401], [402], [403], [404]])(
    'fetch not existed file %i',
    async (status) => {
      axiosMock.onGet().reply(status);

      await expect(async () => {
        await fetchTemplate(url.resolve(defaultOption.src, '?.ignore'));
      }).rejects.toThrow(`${status}`);
    },
  );
});

describe('parse()', () => {
  it('nothing', async () => {
    const actual = await parse([], {});
    const expected = [] as string[];
    expect(actual).toStrictEqual(expected);
  });

  it('empty line', async () => {
    const actual = await parse([''], {});
    const expected = [''];
    expect(actual).toStrictEqual(expected);
  });

  describe('axios mocked to local templates', () => {
    beforeEach(async () => {
      const dirents = await (
        await readdir(templatesPath, {withFileTypes: true})
      ).filter((dirent) => dirent.isFile());

      for (const {name} of dirents) {
        const content = await readFile(path.resolve(templatesPath, name), {
          encoding: 'utf-8',
        });
        axiosMock
          .onGet(url.resolve(defaultOption.src, name))
          .reply((config) => {
            return [200, content];
          });
      }
    });

    afterEach(() => {
      axiosMock.reset();
    });

    it('parse with no templates', async () => {
      const actual = await parse(['dist'], {});
      const expected = ['dist'];
      expect(actual).toStrictEqual(expected);
    });

    it('parse with templates', async () => {
      const actual = await parse(
        ['# ignoregen node', '', '# ignoregen env', ''],
        {},
      );
      const expected = [
        '# ignoregen node',
        'node_modules/',
        '',
        '# ignoregen env',
        '.env*',
        '.envrc',
        '!.env.example',
        '',
      ];
      expect(actual).toStrictEqual(expected);
    });

    it('fetch not-exist template', async () => {
      const actual = await parse(
        ['# ignoregen ?', '', '# ignoregen !', '', '# ignoregen node', ''],
        {},
      );
      await expect(actual).toStrictEqual([
        new Error(
          `Failed to fetch template from "https://raw.githubusercontent.com/SnO2WMaN-HQ/ignoregen-template/master/templates/?.ignore" for "# ignoregen ?"`,
        ),
        new Error(
          `Failed to fetch template from "https://raw.githubusercontent.com/SnO2WMaN-HQ/ignoregen-template/master/templates/!.ignore" for "# ignoregen !"`,
        ),
      ]);
    });
  });
});
