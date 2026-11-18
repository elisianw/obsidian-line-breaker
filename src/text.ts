/**
 * Turns a line-level edit into a minimal CodeMirror change.
 *
 * The plugin computes a new document, then this finds the smallest
 * common prefix/suffix so the transaction only touches what changed. That
 * keeps Obsidian's undo history and decorations coherent; replacing the whole
 * document instead makes the editor discard the change.
 */

export interface Change {
  from: number;
  to: number;
  insert: string;
}

/** Minimal character-level common-prefix/suffix diff of two strings. */
export function diffText(oldText: string, newText: string): Change {
  if (oldText === newText) return { from: 0, to: 0, insert: "" };

  let start = 0;
  const min = Math.min(oldText.length, newText.length);
  while (start < min && oldText[start] === newText[start]) start++;

  let endOld = oldText.length;
  let endNew = newText.length;
  while (endOld > start && endNew > start && oldText[endOld - 1] === newText[endNew - 1]) {
    endOld--;
    endNew--;
  }
  return { from: start, to: endOld, insert: newText.slice(start, endNew) };
}

/** Absolute offset of a line/column pair in `lines`. */
export function offsetOf(lines: string[], line: number, ch: number): number {
  let offset = 0;
  for (let i = 0; i < line; i++) offset += lines[i].length + 1;
  return offset + ch;
}
