export function isEmptyLine(line: string): boolean {
  return !line.trim();
}

export function cutEmptyLines(lines: string[]): string[] {
  return lines.filter((line) => !isEmptyLine(line));
}

export function trimLastEmptyLines(lines: string[]): string[] {
  if (lines.length < 2) return lines;

  let i = lines.length - 1;
  while (isEmptyLine(lines[i]) && isEmptyLine(lines[i - 1])) i -= 1;
  return lines.slice(0, i + 1);
}
