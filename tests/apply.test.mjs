import { test } from "node:test";
import assert from "node:assert/strict";
import { applyEnter, applyBackspace } from "../src/logic.ts";
import { diffText, offsetOf } from "../src/text.ts";

/**
 * Mirrors what main.ts does: compute the new lines, diff the document, apply
 * the minimal change, and resolve the caret. A full-document replacement is
 * what Obsidian discarded earlier, so the diff must reproduce the new text.
 */
function simulate(text, line, ch, edit) {
  const lines = text.split("\n");
  const result = edit(lines, line, ch);
  if (result === null || result === "native") return result;
  const newText = result.lines.join("\n");
  const d = diffText(text, newText);
  const rebuilt = text.slice(0, d.from) + d.insert + text.slice(d.to);
  assert.equal(rebuilt, newText, "diff must reproduce the new document");
  const caret = offsetOf(result.lines, result.line, result.ch);
  return rebuilt.slice(0, caret) + "|" + rebuilt.slice(caret);
}

test("Enter at the end of a paragraph through the diff path", () => {
  assert.equal(simulate("Hello", 0, 5, (l, n, c) => applyEnter(l, n, c, "break")), "Hello\n\n|");
});

test("Enter in the middle of a paragraph through the diff path", () => {
  assert.equal(
    simulate("Hello  world", 0, 5, (l, n, c) => applyEnter(l, n, c, "break")),
    "Hello\n\n|world",
  );
});

test("Enter on a blank line between blocks through the diff path", () => {
  assert.equal(
    simulate("something\n\nsomething", 1, 0, (l, n, c) => applyEnter(l, n, c, "break")),
    "something\n\n|\n\nsomething",
  );
});

test("Backspace removing a run of blank lines through the diff path", () => {
  assert.equal(
    simulate("something\n\n\n\nsomething", 3, 0, (l, n, c) => applyBackspace(l, n, c)),
    "something\n|\nsomething",
  );
});

test("Backspace joining text through the diff path", () => {
  assert.equal(
    simulate("something\n\nsomething", 1, 0, (l, n, c) => applyBackspace(l, n, c)),
    "something |something",
  );
});

test("Backspace at document start passes through", () => {
  assert.equal(simulate("Hello", 0, 0, (l, n, c) => applyBackspace(l, n, c)), null);
});
