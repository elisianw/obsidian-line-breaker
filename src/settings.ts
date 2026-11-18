import { App, PluginSettingTab, Setting } from "obsidian";
import type LineBreakerPlugin from "./main";

export interface LineBreakerSettings {
  enabled: boolean;
}

export const DEFAULT_SETTINGS: LineBreakerSettings = {
  enabled: true,
};

export class LineBreakerSettingTab extends PluginSettingTab {
  plugin: LineBreakerPlugin;

  constructor(app: App, plugin: LineBreakerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Enable Line Breaker")
      .setDesc("Turns the Enter and Backspace rules on or off. Shift+Backspace is never changed.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enabled).onChange(async (value) => {
          this.plugin.settings.enabled = value;
          await this.plugin.saveSettings();
        }),
      );
  }
}
