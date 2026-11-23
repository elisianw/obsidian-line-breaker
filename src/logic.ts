/**
 * Line Breaker: editing rules as pure functions.
 *
 * Input is the document as an array of lines plus the caret (0-based line,
 * 0-based column). Output is the new lines and the new caret, or `null` when
 * the key should be left to Obsidian, or `"native"` when the key should run
 * CodeMirror's own newline command.
 *
 * Enter
 *   - Begin / end / middle of a heading, paragraph or horizontal rule: the line
 *     is split in two with one blank line between the halves. Spaces and tabs
 *     before and after the caret are removed.
 *   - A blank line (spaces or tabs only) between two non-blank lines: it
 *     becomes three blank lines, the caret on the middle one.
 *   - Lists, quotes, footnotes, code, math and tables: left to Obsidian.
 *
 * Shift + Enter
 *   - Heading, paragraph, horizontal rule: plain Enter behaviour (native).
 *   - Begin / end / middle of lists, quotes, footnotes: same split as Enter.
 *   - Code, math, tables and blank lines: left to Obsidian.
 *
 * Backspace (plain)
 *   - On a blank line, or at the start of a horizontal rule, when blank lines
 *     are above: every blank line above is removed except the caret line.
 *   - On a blank line with no blank line above: the text above and the text
 *     below are joined with one space.
 *   - At the start of any other block: with two or more blank lines above, all
 *     but one are removed; with one blank line above, or none, the text above
 *     and the block are joined with one space.
 *   - Code, math and tables are never touched.
 *
 * Shift + Backspace is not handled here: Obsidian's default applies.
 */

export type EnterAction = "break" | "soft-break";

/** A document with the caret position: 0-based line, 0-based column. */
export interface Cursor {
  lines: string[];
  line: number;
  ch: number;
}

/**
 * `null`: leave the key to Obsidian.
 * `"native"`: run CodeMirror's own newline command (plain Enter behaviour).
 */
export type Result = Cursor | "native" | null;

export type Kind =
  | "blank"
  | "heading"
  | "paragraph"
  | "hr"
  | "list"
  | "quote"
  | "footnote"
  | "table"
  | "code"
  | "code-end"
  | "math";

const HEADING_RE = /^ {0,3}#{1,6}(?:[ \t]|$)/;
const HR_RE = /^ {0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/;
const FENCE_OPEN_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const FENCE_CLOSE_RE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;
const MATH_FENCE_RE = /^ {0,3}\$\$/;
const TABLE_RE = /^ {0,3}\|/;
const QUOTE_RE = /^ {0,3}>/;
const FOOTNOTE_RE = /^ {0,3}\[\^[^\]]+\]:/;
const LIST_RE = /^ {0,3}(?:[-*+]|\d{1,9}[.)])(?:[ \t]|$)/;

/** Spaces, tabs and carriage returns only. */
export function isBlankLine(text: string): boolean {
  return /^[ \t\r]*$/.test(text);
}

/** Blocks that the plugin never edits. */
function isProtected(kind: Kind): boolean {
  return kind === "code" || kind === "code-end" || kind === "math" || kind === "table";
}

function blockKind(raw: string): Kind {
  if (isBlankLine(raw)) return "blank";
  if (HR_RE.test(raw)) return "hr";
  if (HEADING_RE.test(raw)) return "heading";
  if (TABLE_RE.test(raw)) return "table";
  if (QUOTE_RE.test(raw)) return "quote";
  if (FOOTNOTE_RE.test(raw)) return "footnote";
  if (LIST_RE.test(raw)) return "list";
  return "paragraph";
}

/** Classifies every line. Fenced code and math blocks take precedence. */
export function classify(lines: string[]): Kind[] {
  const kinds: Kind[] = [];
  let fence: { char: string; len: number } | null = null;
  let math = false;

  for (const raw of lines) {
    if (fence !== null) {
      const close = FENCE_CLOSE_RE.exec(raw);
      if (close !== null && close[1][0] === fence.char && close[1].length >= fence.len) {
        fence = null;
        kinds.push("code-end");
      } else {
        kinds.push("code");
      }
      continue;
    }
    if (math) {
      if (raw.trim() === "$$") math = false;
      kinds.push("math");
      continue;
    }

    const open = FENCE_OPEN_RE.exec(raw);
    if (open !== null && !(open[1][0] === "`" && open[2].includes("`"))) {
      fence = { char: open[1][0], len: open[1].length };
      kinds.push("code");
      continue;
    }

    if (MATH_FENCE_RE.test(raw)) {
      const t = raw.trim();
      // "$$ x $$" on one line is a complete block; a lone "$$" opens one.
      if (t.length > 2 && t.endsWith("$$") && t !== "$$") kinds.push("math");
      else {
        math = true;
        kinds.push("math");
      }
      continue;
    }

    kinds.push(blockKind(raw));
  }

  // A blank line between two list items is part of the list (loose lists).
  for (let i = 1; i < kinds.length - 1; i++) {
    if (kinds[i] !== "blank") continue;
    let back = i - 1;
    while (back >= 0 && kinds[back] === "blank") back--;
    let ahead = i + 1;
    while (ahead < kinds.length && kinds[ahead] === "blank") ahead++;
    if (back >= 0 && ahead < kinds.length && kinds[back] === "list" && kinds[ahead] === "list") {
      kinds[i] = "list";
    }
  }

  // An indented paragraph directly under a list item continues that item.
  for (let i = 1; i < kinds.length; i++) {
    if (kinds[i] === "paragraph" && kinds[i - 1] === "list" && lines[i] !== lines[i].trimStart()) {
      kinds[i] = "list";
    }
  }

  return kinds;
}

/** Splits the line at the caret: blank line between the two halves. */
function split(lines: string[], line: number, ch: number): Cursor {
  const text = lines[line];
  const head = text.slice(0, ch).replace(/[ \t]+$/, "");
  const rest = text.slice(ch).replace(/^[ \t]+/, "");
  return {
    lines: [...lines.slice(0, line), head, "", rest, ...lines.slice(line + 1)],
    line: line + 2,
    ch: 0,
  };
}

/** Puts a caret on a new blank line between two non-blank lines. */
function blankBreak(lines: string[], line: number): Cursor {
  return {
    lines: [...lines.slice(0, line), "", "", "", ...lines.slice(line + 1)],
    line: line + 1,
    ch: 0,
  };
}

/**
 * Joins the text line `a` with the text line `b` (b > a), removing everything
 * between them, with one space. Trailing spaces of `a` and leading spaces of
 * `b` are removed. The caret lands between the two.
 */
function join(lines: string[], a: number, b: number): Cursor {
  const left = lines[a].replace(/[ \t]+$/, "");
  const right = lines[b].replace(/^[ \t]+/, "");
  return {
    lines: [...lines.slice(0, a), left + " " + right, ...lines.slice(b + 1)],
    line: a,
    ch: left.length + 1,
  };
}

/** Enter (break) or Shift+Enter (soft-break) at `line:ch`. */
export function applyEnter(lines: string[], line: number, ch: number, action: EnterAction): Result {
  if (line < 0 || line >= lines.length) return null;
  const text = lines[line];
  if (ch < 0 || ch > text.length) return null;

  const kind = classify(lines)[line];

  // The closing fence of a code block: Enter at its end works like the end of
  // a paragraph. Shift+Enter and every other position stay with Obsidian.
  if (kind === "code-end") {
    return action === "break" && ch === text.length ? split(lines, line, ch) : null;
  }

  if (action === "soft-break") {
    if (kind === "heading" || kind === "paragraph" || kind === "hr") return "native";
    if (kind === "list" || kind === "quote" || kind === "footnote") return split(lines, line, ch);
    return null;
  }

  if (kind === "heading" || kind === "paragraph" || kind === "hr") return split(lines, line, ch);

  if (kind === "blank" && line > 0 && line + 1 < lines.length) {
    if (!isBlankLine(lines[line - 1]) && !isBlankLine(lines[line + 1])) return blankBreak(lines, line);
  }
  return null;
}

/** Backspace at `line:ch`. */
export function applyBackspace(lines: string[], line: number, ch: number): Cursor | null {
  if (line <= 0 || line >= lines.length) return null;
  const kinds = classify(lines);
  const kind = kinds[line];
  if (isProtected(kind)) return null;

  const onBlank = isBlankLine(lines[line]);
  const onHr = kind === "hr" && ch === 0;
  if (onBlank || onHr) return backspaceOnBlank(lines, kinds, line, onBlank);

  if (ch !== 0) return null;
  return backspaceAtBlockStart(lines, kinds, line);
}

/** Blank-run lines directly above `line` that can be edited. */
function blanksAbove(lines: string[], kinds: Kind[], line: number): number {
  let k = 0;
  while (line - k - 1 >= 0 && isBlankLine(lines[line - k - 1]) && !isProtected(kinds[line - k - 1])) {
    k++;
  }
  return k;
}

function backspaceOnBlank(lines: string[], kinds: Kind[], line: number, onBlank: boolean): Cursor | null {
  const k = blanksAbove(lines, kinds, line);

  if (k >= 1) {
    // Remove every blank line above and, on a blank caret line, every blank
    // line below it too: the caret line is left as the only blank line.
    let after = line + 1;
    if (onBlank) {
      while (after < lines.length && isBlankLine(lines[after]) && !isProtected(kinds[after])) after++;
    }
    const kept = onBlank ? "" : lines[line];
    return {
      lines: [...lines.slice(0, line - k), kept, ...lines.slice(after)],
      line: line - k,
      ch: 0,
    };
  }

  // No blank above: join the text above with the text below.
  // A horizontal rule at the caret counts as an empty line, so it is replaced.
  // Blank or whitespace-only lines below the caret are removed by the join.
  const above = line - 1;
  let below = line + 1;
  while (below < lines.length && isBlankLine(lines[below])) below++;
  if (below >= lines.length) return null;
  if (!hasText(lines[above]) || isProtected(kinds[above]) || isProtected(kinds[below])) return null;
  return join(lines, above, below);
}

function backspaceAtBlockStart(lines: string[], kinds: Kind[], line: number): Cursor | null {
  const k = blanksAbove(lines, kinds, line);

  if (k >= 2) {
    // Keep the blank line nearest to the block, remove the rest.
    return {
      // Spaces and tabs after the caret go too.
      lines: [...lines.slice(0, line - k), "", lines[line].replace(/^[ \t]+/, ""), ...lines.slice(line + 1)],
      line: line - k + 1,
      ch: 0,
    };
  }

  if (k === 1) {
    // One blank line: remove it and join with the text above it.
    const a = line - 2;
    if (a < 0 || !hasText(lines[a]) || isProtected(kinds[a])) return null;
    return join(lines, a, line);
  }

  const a = line - 1;
  if (a < 0 || !hasText(lines[a]) || isProtected(kinds[a])) return null;
  return join(lines, a, line);
}

function hasText(text: string): boolean {
  return !isBlankLine(text);
}
