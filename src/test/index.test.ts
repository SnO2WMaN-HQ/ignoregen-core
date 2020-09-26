/* eslint-disable @shopify/jest/no-snapshots */
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import * as fs from 'fs';
import path from 'path';
import url from 'url';
import {promisify} from 'util';
import {parse} from '..';
import {defaultOption} from '../option';

const axiosMock = new MockAdapter(axios);

const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);

const fixturesPath = path.resolve(__dirname, 'fixtures');
const templatesPath = path.resolve(fixturesPath, 'templates');

describe('local fixture test', () => {
  beforeEach(async () => {
    const dirents = await (
      await readdir(templatesPath, {withFileTypes: true})
    ).filter((dirent) => dirent.isFile());

    for (const {name} of dirents) {
      const content = await readFile(path.resolve(templatesPath, name), {
        encoding: 'utf-8',
      });

      axiosMock.onGet(url.resolve(defaultOption.src, name)).reply(200, content);
    }
  });

  afterEach(() => {
    axiosMock.reset();
  });

  describe.each([['1.ignore'], ['2.ignore'], ['3.ignore']])(
    'for %s (success)',
    (targetFile) => {
      it('match snapshot', async () => {
        const target = (
          await readFile(path.resolve(fixturesPath, targetFile), 'utf-8')
        ).split('\n');

        expect(await parse(target, {})).toMatchSnapshot();
      });

      it('parse twice', async () => {
        const target = (
          await readFile(path.resolve(fixturesPath, targetFile), 'utf-8')
        ).split('\n');

        const once = (await parse(target, {})) as string[];
        const twice = await parse(once, {});

        expect(once).toStrictEqual(twice);
      });
    },
  );

  describe.each([['not-exist-template.ignore']])(
    'for %s (failed)',
    (targetFile) => {
      it('throw errors array', async () => {
        const target = (
          await readFile(path.resolve(fixturesPath, targetFile), 'utf-8')
        ).split('\n');

        expect(await parse(target, {})).toMatchSnapshot();
      });
    },
  );
});
