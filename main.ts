import { App, Plugin, PluginSettingTab, Setting, moment } from 'obsidian';

interface HabitTrackerPluginSettings {
  startOfWeek: string;
  monthFormat: string;
  displayHead: boolean;
  enableHTML: boolean;
  Sunday: string;
  Monday: string;
  Tuesday: string;
  Wednesday: string;
  Thursday: string;
  Friday: string;
  Saturday: string;
}

const DEFAULT_SETTINGS: HabitTrackerPluginSettings = {
  startOfWeek: '0',
  monthFormat: 'YYYY-MM',
  displayHead: true,
  enableHTML: false,
  Sunday: 'SUN',
  Monday: 'MON',
  Tuesday: 'TUE',
  Wednesday: 'WED',
  Thursday: 'THU',
  Friday: 'FRI',
  Saturday: 'SAT'
}

export default class HabitTrackerPlugin extends Plugin {
  settings: HabitTrackerPluginSettings;

  async onload() {
    await this.loadSettings();

    this.addSettingTab(new HabitTrackerSettingTab(this.app, this));

    this.registerMarkdownCodeBlockProcessor('habitt', (source, el) => {
      el.appendChild(renderTable(source, this));
    })
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

interface HabitTrackerContext {
  startOfWeek: number;
  startDay: number;
  monthDays: number;
  displayMonth: string;
  tableWidth: string,
  marks: Map<number, string>;
  settings: HabitTrackerPluginSettings,
  error: string
}

function renderTable (source: string, plugin: HabitTrackerPlugin) {
  const { settings } = plugin;
  const ctx = parseContext(source, settings);

  if (ctx.error) {
    return createDiv({ cls: 'habitt-error', text: ctx.error })
  }

  const styles = ctx.tableWidth ? `width: ${ctx.tableWidth};` : '';
  const table = createEl('table', { cls: 'habitt', attr: { style: styles }})
  table.appendChild(renderHead(ctx))
  table.appendChild(renderBody(ctx))
  return table
}

function parseContext(source: string, settings: HabitTrackerPluginSettings): HabitTrackerContext {
  const ctx: HabitTrackerContext = {
    startOfWeek: parseInt(settings.startOfWeek, 10),
    startDay: 0,
    monthDays: 0,
    displayMonth: '',
    tableWidth: '',
    marks: new Map<number, string>(),
    settings,
    error: ''
  };

  // month
  const m = source.match(/\[month:\s*(\S*?)\s*\]/);
  if (!m || !m[1]) {
    ctx.error = 'Fail: Month not found. e.g. [month: 2021-01]';
    return ctx;
  }

  const mon = moment(m[1]);
  if (!mon.isValid()) {
    ctx.error = `Fail: Invalid Date ${m[0]}`;
    return ctx;
  }

  ctx.displayMonth = mon.format(settings.monthFormat);
  ctx.startDay = mon.startOf('month').day();
  ctx.monthDays = mon.endOf('month').date();
  
  // table width (optional)
  const wm = source.match(/\[width:\s*(\S*?)\s*\]/);
  if (wm && wm[1]) {
    ctx.tableWidth = wm[1];
  }

  // punch in
  const pm = source.match(/\((.*?)\)/g);
  if (pm && pm.length) {
    pm.forEach(t => {
      const m = t.match(/\((.*?)(,(.*?))?\)/);
      if (m) {
        const date = parseInt(m[1], 10);
        const tag = m[3];
        ctx.marks.set(date, tag);
      }
    });
  }

  return ctx;
}

function renderHead (ctx: HabitTrackerContext): HTMLElement {
  const { Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday } = ctx.settings;
  const WEEK = [Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday];
  
  const thead = createEl('thead');

  if (ctx.settings.displayHead) {
    const tr = thead.createEl('tr');
    tr.createEl('th', { cls: 'habitt-head', attr: { colspan: 7 }, text: ctx.displayMonth });
  }

  const tr = thead.createEl('tr');
  for (let i = 0; i < 7; i++) {
    tr.createEl('th', { cls: `habitt-th habitt-th-${i}`, text: WEEK[(i + ctx.startOfWeek) % 7] });
  }
  return thead;
}

function renderBody (ctx: HabitTrackerContext): HTMLElement {
  const startHolds = ctx.startDay >= ctx.startOfWeek ? ctx.startDay - ctx.startOfWeek : 7 - ctx.startOfWeek + ctx.startDay;
  let days = (new Array(ctx.monthDays)).fill(0).map((v, i) => i + 1);
  const weeks:number[][] = [];

  if (startHolds) {
    const startWeekDays = 7 - startHolds;
    const firstWeek: number[] = (new Array(startHolds)).fill(0);
    weeks.push(firstWeek.concat(days.slice(0, startWeekDays)));
    days = days.slice(startWeekDays);
  }

  let i = 0;
  while (i < days.length) {
    weeks.push(days.slice(i, i + 7));
    i = i + 7;
  }

  const lastWeek = weeks[weeks.length - 1];
  if (lastWeek.length < 7) {
    const pad = 7 - lastWeek.length;
    for (let i = 0; i < pad; i++) {
      lastWeek.push(0);
    }
  }
  
  const tbody = createEl('tbody');
  const { enableHTML } = ctx.settings
  for (let i = 0; i < weeks.length; i++) {
    const tr = tbody.createEl('tr');
    for (let j = 0; j < weeks[i].length; j++) {
      const d = weeks[i][j];
      const hasOwn = ctx.marks.has(d);
      const td = tr.createEl('td', { cls: `habitt-td habitt-td--${d || 'disabled'} ${hasOwn ? 'habitt-td--checked' : ''}`});
      const div = td.createDiv({ cls: 'habitt-c' });
      div.createDiv({ cls: 'habitt-date', text: `${d || ''}` });
      const dots = div.createDiv({ cls: 'habitt-dots' });
      if (hasOwn) {
        const input = ctx.marks.get(d) || '✔️'
        // treat as HTML
        if (enableHTML) {
          dots.innerHTML = `<div>${input}</div>`
        } else {
          dots.createDiv({ text: input });
        }
      }
    }
  }
  return tbody;
}

class HabitTrackerSettingTab extends PluginSettingTab {
  plugin: HabitTrackerPlugin;

  constructor(app: App, plugin: HabitTrackerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const {containerEl} = this;

    containerEl.empty();

    // containerEl.createEl('h2', {text: 'Settings for my awesome plugin.'});
    const weeks: Record<string, string> = {
      '0': 'Sunday',
      '1': 'Monday',
      '2': 'Tuesday',
      '3': 'Wednesday',
      '4': 'Thursday',
      '5': 'Friday',
      '6': 'Saturday'
    };
    new Setting(containerEl)
      .setName('Start Of Week')
      .setDesc('The day a week begins.')
      .addDropdown(
        dropdown => dropdown
          .addOptions(weeks)
          .setValue(this.plugin.settings.startOfWeek)
          .onChange(async (value) => {
            this.plugin.settings.startOfWeek = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Display Table Header')
      .addToggle(
        dropdown => dropdown
          .setValue(this.plugin.settings.displayHead)
          .onChange(async (value) => {
            this.plugin.settings.displayHead = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Enable HTML')
      .setDesc('Treat your input text as HTML. Be careful, it may cause DOM injection attacks')
      .addToggle(
        dropdown => dropdown
          .setValue(this.plugin.settings.enableHTML)
          .onChange(async (value) => {
            this.plugin.settings.enableHTML = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Month Format')
      .setDesc('To format the month text which displays in the header')
      .addText(text => text
        .setValue(this.plugin.settings.monthFormat)
        .onChange(async (value) => {
          this.plugin.settings.monthFormat = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('Sunday Label')
      .setDesc('Default is SUN')
      .addText(text => text
        .setValue(this.plugin.settings.Sunday)
        .onChange(async (value) => {
          this.plugin.settings.Sunday = value || DEFAULT_SETTINGS.Sunday;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('Monday Label')
      .setDesc('Default is MON')
      .addText(text => text
        .setValue(this.plugin.settings.Monday)
        .onChange(async (value) => {
          this.plugin.settings.Monday = value || DEFAULT_SETTINGS.Monday;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('Tuesday Label')
      .setDesc('Default is TUE')
      .addText(text => text
        .setValue(this.plugin.settings.Tuesday)
        .onChange(async (value) => {
          this.plugin.settings.Tuesday = value || DEFAULT_SETTINGS.Tuesday;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('Wednesday Label')
      .setDesc('Default is WED')
      .addText(text => text
        .setValue(this.plugin.settings.Wednesday)
        .onChange(async (value) => {
          this.plugin.settings.Wednesday = value || DEFAULT_SETTINGS.Wednesday;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('Thursday Label')
      .setDesc('Default is THU')
      .addText(text => text
        .setValue(this.plugin.settings.Thursday)
        .onChange(async (value) => {
          this.plugin.settings.Thursday = value || DEFAULT_SETTINGS.Thursday;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('Friday Label')
      .setDesc('Default is FRI')
      .addText(text => text
        .setValue(this.plugin.settings.Friday)
        .onChange(async (value) => {
          this.plugin.settings.Friday = value || DEFAULT_SETTINGS.Friday;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('Saturday Label')
      .setDesc('Default is SAT')
      .addText(text => text
        .setValue(this.plugin.settings.Saturday)
        .onChange(async (value) => {
          this.plugin.settings.Saturday = value || DEFAULT_SETTINGS.Saturday;
          await this.plugin.saveSettings();
        }));
  }
}
