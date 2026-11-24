import { test } from "node:test";
import assert from "node:assert/strict";
import { applyEnter, applyBackspace, applyDelete, classify } from "../src/logic.ts";

/** Input uses "|" for the caret; it must appear once. */
function parse(input) {
  const lines = input.split("\n");
  const line = lines.findIndex((l) => l.includes("|"));
  assert.ok(line >= 0, `missing | in ${JSON.stringify(input)}`);
  const ch = lines[line].indexOf("|");
  lines[line] = lines[line].slice(0, ch) + lines[line].slice(ch + 1);
  return { lines, line, ch };
}

/** Renders the document with "|" at the caret. */
function show(cur) {
  return cur.lines
    .map((l, i) => (i === cur.line ? l.slice(0, cur.ch) + "|" + l.slice(cur.ch) : l))
    .join("\n");
}

function del(input) {
  const { lines, line, ch } = parse(input);
  const r = applyDelete(lines, line, ch);
  return r === null ? null : show(r);
}

function enter(input, action = "break") {
  const { lines, line, ch } = parse(input);
  const r = applyEnter(lines, line, ch, action);
  return r === null || r === "native" ? r : show(r);
}

function backspace(input) {
  const { lines, line, ch } = parse(input);
  const r = applyBackspace(lines, line, ch);
  return r === null ? null : show(r);
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

test("classifies each block kind", () => {
  assert.deepEqual(
    classify([
      "# h",
      "p",
      "",
      "---",
      "- item",
      "> quote",
      "> [!note] callout",
      "[^1]: note",
      "| a |",
      "```",
      "code",
      "```",
      "$$",
      "x",
      "$$",
    ]),
    [
      "heading",
      "paragraph",
      "blank",
      "hr",
      "list",
      "quote",
      "quote",
      "footnote",
      "table",
      "code",
      "code",
      "code-end",
      "math",
      "math",
      "math",
    ],
  );
});

test("a blank line between two list items belongs to the list", () => {
  assert.deepEqual(classify(["- a", "", "- b"]), ["list", "list", "list"]);
});

test("blank lines inside a code block are code", () => {
  assert.deepEqual(classify(["```", "", "```"]), ["code", "code", "code-end"]);
});

// ---------------------------------------------------------------------------
// Enter: headings, paragraphs, horizontal rules
// ---------------------------------------------------------------------------

test("Enter at the end of a heading makes two line breaks", () => {
  assert.equal(enter("# Title|"), "# Title\n\n|");
});

test("Enter at the beginning of a heading makes two line breaks", () => {
  assert.equal(enter("|# Title"), "\n\n|# Title");
});

test("Enter in the middle of a heading splits it with one blank line", () => {
  assert.equal(enter("# Ti|tle"), "# Ti\n\n|tle");
});

test("Enter at the end of a paragraph makes two line breaks", () => {
  assert.equal(enter("Hello|"), "Hello\n\n|");
});

test("Enter at the beginning of a paragraph makes two line breaks", () => {
  assert.equal(enter("|Hello"), "\n\n|Hello");
});

test("Enter in the middle of a paragraph removes spaces and tabs around the caret", () => {
  assert.equal(enter("Hello  \t|  \tworld"), "Hello\n\n|world");
});

test("Enter in the middle of a paragraph keeps the text below", () => {
  assert.equal(enter("Hello|\nWorld"), "Hello\n\n|\nWorld");
});

test("Enter at the end of a paragraph followed by a blank line still makes two breaks", () => {
  assert.equal(enter("Hello|\n\nWorld"), "Hello\n\n|\n\nWorld");
});

test("Enter at the end of a horizontal rule makes two line breaks", () => {
  assert.equal(enter("---|"), "---\n\n|");
});

test("Enter at the beginning of a horizontal rule makes two line breaks", () => {
  assert.equal(enter("|---"), "\n\n|---");
});

// ---------------------------------------------------------------------------
// Enter: blank lines between blocks
// ---------------------------------------------------------------------------

test("Enter on a blank line between two blocks makes a blank line above and below", () => {
  assert.equal(enter("something\n|\nsomething"), "something\n\n|\n\nsomething");
});

test("Enter on a blank line holding spaces or tabs counts as blank", () => {
  assert.equal(enter("something\n \t|  \t\nsomething"), "something\n\n|\n\nsomething");
});

test("Enter on a blank line between a list and a paragraph works", () => {
  assert.equal(enter("- one\n|\nparagraph"), "- one\n\n|\n\nparagraph");
});

test("Enter on a trailing blank line passes through", () => {
  assert.equal(enter("something\n|"), null);
});

test("Enter on a blank line at the start of the document passes through", () => {
  assert.equal(enter("|\nsomething"), null);
});

// ---------------------------------------------------------------------------
// Enter: ignored blocks
// ---------------------------------------------------------------------------

test("Enter on a list item passes through", () => {
  assert.equal(enter("- one|"), null);
});

test("Enter in a quote passes through", () => {
  assert.equal(enter("> quote|"), null);
});

test("Enter in a callout passes through", () => {
  assert.equal(enter("> [!note] Title|"), null);
});

test("Enter in a footnote passes through", () => {
  assert.equal(enter("[^1]: note|"), null);
});

test("Enter in a fenced code block passes through", () => {
  assert.equal(enter("```\ncode|\n```"), null);
});

test("Enter at the end of the closing fence of a code block makes two line breaks", () => {
  assert.equal(enter("```\ncode\n```|"), "```\ncode\n```\n\n|");
});

test("Enter at the start of the closing fence passes through", () => {
  assert.equal(enter("|```\ncode\n```"), null);
});

test("Shift+Enter at the end of the closing fence passes through", () => {
  assert.equal(enter("```\ncode\n```|", "soft-break"), null);
});

test("Enter in a math block passes through", () => {
  assert.equal(enter("$$\nx = 1|\n$$"), null);
});

test("Enter in a table passes through", () => {
  // The table uses "|" itself, so the caret is given as a plain index.
  assert.equal(applyEnter(["| a | b |", "| - | - |", "| x | y |"], 2, 4, "break"), null);
});

// ---------------------------------------------------------------------------
// Shift+Enter
// ---------------------------------------------------------------------------

test("Shift+Enter at the end of a heading behaves like plain Enter (native)", () => {
  assert.equal(enter("# Title|", "soft-break"), "native");
});

test("Shift+Enter at the beginning of a paragraph behaves like plain Enter (native)", () => {
  assert.equal(enter("|Hello", "soft-break"), "native");
});

test("Shift+Enter in the middle of a paragraph behaves like plain Enter (native)", () => {
  assert.equal(enter("Hel|lo", "soft-break"), "native");
});

test("Shift+Enter on a horizontal rule behaves like plain Enter (native)", () => {
  assert.equal(enter("---|", "soft-break"), "native");
});

test("Shift+Enter at the end of a list item makes two line breaks", () => {
  assert.equal(enter("- one|", "soft-break"), "- one\n\n|");
});

test("Shift+Enter at the beginning of a list item makes two line breaks", () => {
  assert.equal(enter("|- one", "soft-break"), "\n\n|- one");
});

test("Shift+Enter in the middle of a list item splits it with one blank line", () => {
  assert.equal(enter("- on |e", "soft-break"), "- on\n\n|e");
});

test("Shift+Enter at the end of a quote makes two line breaks", () => {
  assert.equal(enter("> quote|", "soft-break"), "> quote\n\n|");
});

test("Shift+Enter in the middle of a callout splits it with one blank line", () => {
  assert.equal(enter("> [!note] Ti|tle", "soft-break"), "> [!note] Ti\n\n|tle");
});

test("Shift+Enter at the end of a footnote makes two line breaks", () => {
  assert.equal(enter("[^1]: note|", "soft-break"), "[^1]: note\n\n|");
});

test("Shift+Enter in a code block passes through", () => {
  assert.equal(enter("```\ncode|\n```", "soft-break"), null);
});

test("Shift+Enter in a math block passes through", () => {
  assert.equal(enter("$$\nx|\n$$", "soft-break"), null);
});

test("Shift+Enter on a blank line passes through", () => {
  assert.equal(enter("something\n|\nsomething", "soft-break"), null);
});

// ---------------------------------------------------------------------------
// Backspace: blank lines
// ---------------------------------------------------------------------------

test("Backspace on a blank line removes every blank above except the caret line", () => {
  assert.equal(backspace("something\n\n\n|\nsomething"), "something\n|\nsomething");
});

test("Backspace on a blank line removes the blank lines below it too", () => {
  assert.equal(backspace("something\n\n|\n\n\nsomething"), "something\n|\nsomething");
});

test("Backspace on a blank line with one blank above removes it", () => {
  assert.equal(backspace("something\n\n|\nsomething"), "something\n|\nsomething");
});

test("Backspace on a blank line with spaces or tabs above removes them too", () => {
  assert.equal(backspace("something\n  \t\n|\nsomething"), "something\n|\nsomething");
});

test("Backspace on a blank line with no blank above joins the lines with a space", () => {
  assert.equal(backspace("something\n|\nsomething"), "something |something");
});

test("Backspace on a blank line joins, removing spaces and tabs around the join", () => {
  assert.equal(backspace("something  \t\n  |  \t\n  \tsomething"), "something |something");
});

test("Backspace on a trailing blank line passes through", () => {
  assert.equal(backspace("Hello\n|"), null);
});

test("Backspace on a blank line with nothing above passes through", () => {
  assert.equal(backspace("|\nHello"), null);
});

// ---------------------------------------------------------------------------
// Backspace: start of a block
// ---------------------------------------------------------------------------

test("Backspace at the start of a block with two blank lines above keeps one", () => {
  assert.equal(backspace("something\n\n\n|body"), "something\n\n|body");
});

test("Backspace at the start of a block with many blank lines above keeps one", () => {
  assert.equal(backspace("something\n\n \t\n\n|body"), "something\n\n|body");
});

test("Backspace at the start of a block removes spaces after the caret", () => {
  assert.equal(backspace("something\n\n\n|   body"), "something\n\n|body");
});

test("Backspace on a blank line joins past whitespace-only lines below", () => {
  assert.equal(backspace("something\n|\n \t\nsomething"), "something |something");
});

test("Backspace at the start of a block with one blank above joins with a space", () => {
  assert.equal(backspace("something\n\n|body"), "something |body");
});

test("Backspace at the start of a block with no blank above joins with a space", () => {
  assert.equal(backspace("something\n|body"), "something |body");
});

test("Backspace at the start of a block removes spaces and tabs around the join", () => {
  assert.equal(backspace("something \t\n|   body"), "something |body");
});

test("Backspace inside a line passes through", () => {
  assert.equal(backspace("something\nbo|dy"), null);
});

test("Backspace at the start of a block after a code block passes through", () => {
  assert.equal(backspace("```\na\n```\n|text"), null);
});

// ---------------------------------------------------------------------------
// Backspace: horizontal rules
// ---------------------------------------------------------------------------

test("Backspace at the start of a rule with blank lines above removes them", () => {
  assert.equal(backspace("text\n\n|---\nmore"), "text\n|---\nmore");
});

test("Backspace at the start of a rule with no blank above joins the lines", () => {
  assert.equal(backspace("text\n|---\nmore"), "text |more");
});

test("Backspace inside a rule passes through", () => {
  assert.equal(backspace("text\n-|--\nmore"), null);
});

// ---------------------------------------------------------------------------
// Delete (forward)
// ---------------------------------------------------------------------------

test("Delete on a blank line removes blank lines above, like Backspace", () => {
  assert.equal(del("something\n\n\n|\nsomething"), "something\n|\nsomething");
});

test("Delete on a blank line between text joins the text with a space", () => {
  assert.equal(del("something\n|\nsomething"), "something |something");
});

test("Delete at the end of a text line joins the line below with a space", () => {
  assert.equal(del("something|\nsomething"), "something |something");
});

test("Delete at the end of a text line joins past blank lines below", () => {
  assert.equal(del("something|\n\n\nsomething"), "something |something");
});

test("Delete at the end of a text line removes spaces and tabs around the join", () => {
  assert.equal(del("something \t|\n  \tsomething"), "something |something");
});

test("Delete in the middle of a line passes through", () => {
  assert.equal(del("some|thing\nnext"), null);
});

test("Delete at the end of the last line passes through", () => {
  assert.equal(del("something|"), null);
});

test("Delete at the end of a code line passes through", () => {
  assert.equal(del("```\ncode|\n```"), null);
});

test("Delete on a blank line inside a code block passes through", () => {
  assert.equal(del("```\n|\n```"), null);
});

test("Delete at the end of a heading joins the paragraph below", () => {
  assert.equal(del("# Title|\nbody"), "# Title |body");
});
