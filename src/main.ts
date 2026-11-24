import { Plugin } from "obsidian";
import { insertNewlineAndIndent } from "@codemirror/commands";
import { Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { applyBackspace, applyDelete, applyEnter, Cursor, EnterAction } from "./logic";
import { DEFAULT_SETTINGS, LineBreakerSettings, LineBreakerSettingTab } from "./settings";
import { diffText, offsetOf } from "./text";

/**
 * Line Breaker.
 *
 * Enter, Shift+Enter and Backspace run through a CodeMirror keymap at the
 * highest precedence. Each handler returns `false` when the rules do not
 * apply, so Obsidian keeps its own behaviour there. Shift+Backspace is not
 * bound.
 */
export default class LineBreakerPlugin extends Plugin {
  settings: LineBreakerSettings = { ...DEFAULT_SETTINGS };

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new LineBreakerSettingTab(this.app, this));

    this.registerEditorExtension([
      Prec.highest(
        keymap.of([
          { key: "Enter", run: (view) => this.onEnter(view, "break") },
          { key: "Shift-Enter", run: (view) => this.onEnter(view, "soft-break") },
          { key: "Backspace", run: (view) => this.onBackspace(view) },
          { key: "Delete", run: (view) => this.onDelete(view) },
          { key: "Shift-Delete", run: (view) => this.onDelete(view) },
        ]),
      ),
    ]);
  }

  private onEnter(view: EditorView, action: EnterAction): boolean {
    try {
      if (!this.canHandle(view)) return false;
      const caret = this.caret(view);
      const result = applyEnter(this.lines(view), caret.line, caret.ch, action);
      if (result === null) return false;
      if (result === "native") return insertNewlineAndIndent(view);
      this.apply(view, result);
      return true;
    } catch (error) {
      console.error("line-breaker: Enter failed", error);
      return false;
    }
  }

  private onBackspace(view: EditorView): boolean {
    try {
      if (!this.canHandle(view)) return false;
      const caret = this.caret(view);
      const result = applyBackspace(this.lines(view), caret.line, caret.ch);
      if (result === null) return false;
      this.apply(view, result);
      return true;
    } catch (error) {
      console.error("line-breaker: Backspace failed", error);
      return false;
    }
  }

  private onDelete(view: EditorView): boolean {
    try {
      if (!this.canHandle(view)) return false;
      const caret = this.caret(view);
      const result = applyDelete(this.lines(view), caret.line, caret.ch);
      if (result === null) return false;
      this.apply(view, result);
      return true;
    } catch (error) {
      console.error("line-breaker: Delete failed", error);
      return false;
    }
  }

  /** Enabled, not composing (IME), and a single collapsed cursor. */
  private canHandle(view: EditorView): boolean {
    if (!this.settings.enabled) return false;
    if (view.composing) return false;
    const sel = view.state.selection;
    return sel.ranges.length === 1 && sel.main.empty;
  }

  private lines(view: EditorView): string[] {
    return view.state.doc.toString().split("\n");
  }

  private caret(view: EditorView): { line: number; ch: number } {
    const head = view.state.selection.main.head;
    const line = view.state.doc.lineAt(head);
    return { line: line.number - 1, ch: head - line.from };
  }

  /** Applies the result as one transaction with a minimal diff (keeps undo coherent). */
  private apply(view: EditorView, result: Cursor): void {
    const oldText = view.state.doc.toString();
    const newText = result.lines.join("\n");
    if (oldText === newText) return;

    const change = diffText(oldText, newText);
    const caret = offsetOf(result.lines, result.line, result.ch);

    view.dispatch({
      changes: change,
      selection: { anchor: Math.min(caret, newText.length) },
      userEvent: "input",
      scrollIntoView: true,
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
