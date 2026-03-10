import { App, PluginSettingTab, Setting } from 'obsidian';
import MPPlugin from '../main';

export class MPSettingTab extends PluginSettingTab {
  plugin: MPPlugin;

  constructor(app: App, plugin: MPPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass('mp-settings');

    containerEl.createEl('h2', { text: 'MP Publisher 设置' });

    new Setting(containerEl)
      .setName('主题管理')
      .setDesc('管理内置主题、云端主题和本地自定义 CSS 主题')
      .addButton(btn => btn
        .setButtonText('打开主题管理')
        .setCta()
        .onClick(() => {
          this.plugin.activateThemeManager();
        }));

    containerEl.createEl('h3', { text: '界面设置' });

    new Setting(containerEl)
      .setName('新标签页打开预览')
      .setDesc('开启后在新标签页打开预览；关闭则在右侧边栏打开')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settingsManager.getSettings().openInNewTab)
        .onChange(async (value) => {
          await this.plugin.settingsManager.updateSettings({
            openInNewTab: value,
          });
        }));

    containerEl.createEl('h3', { text: '微信公众号配置' });

    new Setting(containerEl)
      .setName('AppID')
      .setDesc('微信公众号的 AppID')
      .addText(text => text
        .setPlaceholder('输入 AppID')
        .setValue(this.plugin.settingsManager.getSettings().wechatAppId || '')
        .onChange(async (value) => {
          await this.plugin.settingsManager.updateSettings({
            wechatAppId: value,
          });
        }));

    new Setting(containerEl)
      .setName('AppSecret')
      .setDesc('微信公众号的 AppSecret')
      .addText(text => text
        .setPlaceholder('输入 AppSecret')
        .setValue(this.plugin.settingsManager.getSettings().wechatAppSecret || '')
        .onChange(async (value) => {
          await this.plugin.settingsManager.updateSettings({
            wechatAppSecret: value,
          });
        }));

    new Setting(containerEl)
      .setName('图片存储位置')
      .setDesc('设置图片保存的文件夹路径。支持使用 ${filename} 代表当前文档的文件名')
      .addText(text => text
        .setPlaceholder('${filename}__assets')
        .setValue(this.plugin.settingsManager.getSettings().imageAttachmentLocation || '')
        .onChange(async (value) => {
          await this.plugin.settingsManager.updateSettings({
            imageAttachmentLocation: value,
          });
        }));

    containerEl.createEl('h3', { text: 'AI 生图设置' });

    new Setting(containerEl)
      .setName('API 地址')
      .setDesc('兼容 OpenAI Images API 的接口地址（可填 Base URL，如 https://api.openai.com）')
      .addText(text => text
        .setPlaceholder('https://api.example.com')
        .setValue(this.plugin.settingsManager.getSettings().aiImageApiBaseUrl || '')
        .onChange(async (value) => {
          await this.plugin.settingsManager.updateSettings({
            aiImageApiBaseUrl: value.trim(),
          });
        }));

    new Setting(containerEl)
      .setName('API 密钥')
      .setDesc('用于调用生图接口（将保存在本地插件设置中）')
      .addText(text => {
        text.inputEl.type = 'password';
        text.setPlaceholder('sk-...')
          .setValue(this.plugin.settingsManager.getSettings().aiImageApiKey || '')
          .onChange(async (value) => {
            await this.plugin.settingsManager.updateSettings({
              aiImageApiKey: value.trim(),
            });
          });
      });

    new Setting(containerEl)
      .setName('生图模型')
      .setDesc('例如 gpt-image-1 / dall-e-3 / 其他兼容模型名')
      .addText(text => text
        .setPlaceholder('gpt-image-1')
        .setValue(this.plugin.settingsManager.getSettings().aiImageModel || '')
        .onChange(async (value) => {
          await this.plugin.settingsManager.updateSettings({
            aiImageModel: value.trim(),
          });
        }));

    new Setting(containerEl)
      .setName('调试模式')
      .setDesc('开启后将显示更详细的调试日志信息')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settingsManager.getSettings().debugMode)
        .onChange(async (value) => {
          await this.plugin.settingsManager.updateSettings({
            debugMode: value,
          });
          this.plugin.logger.setDebugMode(value);
        }));
  }
}
