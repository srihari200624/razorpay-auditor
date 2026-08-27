/** A regex match resolved to a source line, for reporting. */
export interface Match {
  index: number;
  lineNumber: number;
  matchedCode: string;
}

export function locate(content: string, index: number): Match {
  const upTo = content.slice(0, index);
  const lineNumber = upTo.split("\n").length;
  const lineStart = upTo.lastIndexOf("\n") + 1;
  const lineEnd = content.indexOf("\n", index);
  const line = content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd);
  return { index, lineNumber, matchedCode: line.trim() };
}

export function findMatch(content: string, pattern: RegExp): Match | null {
  const m = pattern.exec(content);
  if (!m) return null;
  return locate(content, m.index);
}
