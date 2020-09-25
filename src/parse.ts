import axios from 'axios';
import url from 'url';
import {defaultOption} from './default';
import {Option, TemplateBlock} from './types';
import {cutEmptyLines} from './utils';

export function isTemplateBlock(
  cur: string | TemplateBlock,
): cur is TemplateBlock {
  return typeof cur !== 'string';
}

export function isTemplateComment(line: string) {
  return /^# ignoregen .*$/.test(line);
}

export function separateBlocks(lines: string[]): (string | TemplateBlock)[] {
  const rtn: ReturnType<typeof separateBlocks> = [];
  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i];
    if (isTemplateComment(cur)) {
      const block = lines.slice(i + 1, lines.indexOf('', i));
      i += block.length + 1;
      rtn.push({comment: cur, content: block});
    } else rtn.push(cur);
  }
  return rtn;
}

export function analyzeBlocks(blocks: ReturnType<typeof separateBlocks>) {
  return Promise.all(
    blocks.map(async (block) => {
      if (!isTemplateBlock(block)) return block;

      const parsed = parseComment(block.comment);

      const templateURL = createTemplateURL(parsed);

      return fetchTemplate(templateURL)
        .then((template) => ({
          ...block,
          content: template,
        }))
        .catch(() => ({
          ...block,
          error: `Failed to fetch template from "${templateURL}" for "${block.comment}"`,
        }));
    }),
  );
}

export function joinBlocks(blocks: ReturnType<typeof separateBlocks>) {
  const errors = blocks
    .filter(isTemplateBlock)
    .filter(({error}) => Boolean(error)) as Required<TemplateBlock>[];
  if (errors.length) {
    return errors.map(({error}) => new Error(error));
  }

  return blocks.reduce((pre, cur, i) => {
    if (isTemplateBlock(cur)) return [...pre, cur.comment, ...cur.content, ''];
    else return [...pre, cur];
  }, [] as string[]);
}

export function parseComment(comment: string): {name: string; option: Option} {
  const [, , name, ...other] = comment.split(' ');

  const optionRaw = other.join('');
  const option: Option = {
    ...defaultOption,
    ...JSON.parse(optionRaw || '{}'),
  };

  return {name, option};
}

export function createTemplateURL({
  name,
  option: {src},
}: ReturnType<typeof parseComment>): string {
  return url.resolve(src, `${name}.ignore`);
}

export function fetchTemplate(url: string) {
  return axios
    .get<string>(url)
    .then(({data}) => cutEmptyLines(data.split('\n')));
}

export async function parse(lines: string[]) {
  return analyzeBlocks(separateBlocks(lines)).then(joinBlocks);
}
