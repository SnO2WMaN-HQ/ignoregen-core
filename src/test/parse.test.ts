/* eslint-disable @shopify/jest/no-snapshots */
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import * as fs from 'fs';
import path from 'path';
import url from 'url';
import {promisify} from 'util';
import {parse} from '..';
import {defaultOption} from '../default';
import {
  createTemplateURL,
  extractTemplate,
  extractTemplates,
  fetchTemplate,
  flatten,
  parseComment,
  parseLines,
} from '../parse';

const fixturesPath = path.resolve(__dirname, 'fixtures');
const templatesPath = path.resolve(fixturesPath, 'templates');

const axiosMock = new MockAdapter(axios);
const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);

describe('parseComment()', () => {
  describe('with no provided option', () => {
    it('no option', () => {
      const actual = parseComment('# ignoregen env');
      expect(actual).toStrictEqual({
        name: 'env',
        option: {src: defaultOption.src},
      });
    });

    it('empty option', () => {
      const actual = parseComment('# ignoregen env {}');
      expect(actual).toStrictEqual({
        name: 'env',
        option: {src: defaultOption.src},
      });
    });

    it('src override', () => {
      const actual = parseComment(
        '# ignoregen env {"src": "https://example.com/ignores/"}',
      );
      expect(actual).toStrictEqual({
        name: 'env',
        option: {src: 'https://example.com/ignores/'},
      });
    });
  });
});

describe('parseLines()', () => {
  it('no template', () => {
    const actual = parseLines(['dist']);
    const expected = [['dist']];
    expect(actual).toStrictEqual(expected);
  });

  it('missing name template', () => {
    const actual = parseLines(['# ignoregen']);
    const expected = [['# ignoregen']];
    expect(actual).toStrictEqual(expected);
  });

  it('with empty line', () => {
    const actual = parseLines(['', '']);
    const expected = [[''], ['']];
    expect(actual).toStrictEqual(expected);
  });

  it('template', () => {
    const actual = parseLines(['# ignoregen node']);
    const expected = [
      ['# ignoregen node', {name: 'node', option: {src: defaultOption.src}}],
    ];
    expect(actual).toStrictEqual(expected);
  });

  it('template with custom option', () => {
    const actual = parseLines([
      '# ignoregen node {"src": "https://example.com/ignores/"}',
    ]);
    const expected = [
      [
        '# ignoregen node {"src": "https://example.com/ignores/"}',
        {name: 'node', option: {src: 'https://example.com/ignores/'}},
      ],
    ];
    expect(actual).toStrictEqual(expected);
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

    it('fetch not existed file 404', async () => {
      await expect(async () => {
        await fetchTemplate(url.resolve(defaultOption.src, '?.ignore'));
      }).rejects.toThrowErrorMatchingInlineSnapshot(
        `"Request failed with status code 404"`,
      );
    });
  });

  afterEach(() => {
    axiosMock.reset();
  });
});

describe('extractTemplate()', () => {
  afterEach(() => {
    axiosMock.reset();
  });

  it('success', async () => {
    axiosMock
      .onGet(url.resolve(defaultOption.src, 'node.ignore'))
      .reply(200, 'node_modules/\n');

    const actual = await extractTemplate([
      '# ignoregen node',
      {name: 'node', option: defaultOption},
    ]);
    const expected = ['# ignoregen node', 'node_modules/', ''];
    expect(actual).toStrictEqual(expected);
  });

  it('failed', async () => {
    axiosMock.onGet(url.resolve(defaultOption.src, 'node.ignore')).reply(404);

    await expect(async () => {
      await extractTemplate([
        '# ignoregen node',
        {name: 'node', option: defaultOption},
      ]);
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Request failed with status code 404"`,
    );
  });
});

describe('extractTemplates()', () => {
  it('no template', async () => {
    const actual = await extractTemplates([['dist']]);
    const expected = [['dist']];
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

    it('extract one template', async () => {
      const actual = await extractTemplates([
        ['# ignoregen node', {name: 'node', option: {src: defaultOption.src}}],
      ]);
      const expected = [['# ignoregen node', 'node_modules/', '']];
      expect(actual).toStrictEqual(expected);
    });

    it('extract templates', async () => {
      const actual = await extractTemplates([
        ['# ignoregen node', {name: 'node', option: defaultOption}],
        ['# ignoregen env', {name: 'env', option: defaultOption}],
      ]);
      const expected = [
        ['# ignoregen node', 'node_modules/', ''],
        ['# ignoregen env', '.env*', '.envrc', '!.env.example', ''],
      ];
      expect(actual).toStrictEqual(expected);
    });

    it('extract templates but everything failed', async () => {
      await expect(async () => {
        await extractTemplates([
          ['# ignoregen ?', {name: '?', option: defaultOption}],
          ['# ignoregen !', {name: '!', option: defaultOption}],
        ]);
      }).rejects.toThrowErrorMatchingInlineSnapshot(
        `"Request failed with status code 404"`,
      );
    });

    it('extract two templates but one template failed', async () => {
      await expect(async () => {
        await extractTemplates([
          ['# ignoregen ?', {name: '?', option: defaultOption}],
          ['# ignoregen node', {name: 'node', option: defaultOption}],
        ]);
      }).rejects.toThrowErrorMatchingInlineSnapshot(
        `"Request failed with status code 404"`,
      );
    });
  });
});

describe('flatten()', () => {
  it('simply flatten', () => {
    const actual = flatten([
      ['# ignoregen node', 'node_modules/', ''],
      ['# ignoregen env', '.env*', '.envrc', '!.env.example', ''],
      [''],
    ]);
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

  it('cut last empty lines', () => {
    const actual = flatten([
      ['# ignoregen node', 'node_modules/', ''],
      ['# ignoregen env', '.env*', '.envrc', '!.env.example', ''],
      ['', '', ''],
    ]);
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

  it('nothing', () => {
    const actual = flatten([[]]);
    const expected = [] as string[];
    expect(actual).toStrictEqual(expected);
  });

  it('empty line', () => {
    const actual = flatten([['']]);
    const expected = [''];
    expect(actual).toStrictEqual(expected);
  });
});

describe('parse()', () => {
  it('nothing', async () => {
    const actual = await parse([]);
    const expected = [] as string[];
    expect(actual).toStrictEqual(expected);
  });

  it('empty line', async () => {
    const actual = await parse(['']);
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
      const actual = await parse(['dist']);
      const expected = ['dist'];
      expect(actual).toStrictEqual(expected);
    });

    it('parse with templates', async () => {
      const actual = await parse(['# ignoregen node', '# ignoregen env', '']);
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
  });
});
