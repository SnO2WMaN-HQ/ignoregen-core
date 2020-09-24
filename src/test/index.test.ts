/* eslint-disable @shopify/jest/no-snapshots */
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import * as fs from 'fs';
import path from 'path';
import url from 'url';
import {promisify} from 'util';
import {parse} from '..';
import {defaultOption} from '../default';

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

  it.each([['1.ignore'], ['2.ignore'], ['3.ignore']])(
    'check for %s',
    async (targetFile) => {
      const target = (
        await readFile(path.resolve(fixturesPath, targetFile), 'utf-8')
      ).split('\n');

      expect(await parse(target)).toMatchSnapshot();
    },
  );
});
