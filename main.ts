import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, MarkdownRenderChild, moment } from 'obsidian';

interface HabitTrackerPluginSettings {
	startOfWeek: string;
	monthFormat: string;
	displayHead: boolean;
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

		this.registerMarkdownCodeBlockProcessor('habitt', (source, el, ctx) => {
			ctx.addChild(new HabitTrackerMonthViewRenderer(source, el, this))
		})
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class HabitTrackerMonthViewRenderer extends MarkdownRenderChild {
	startOfWeek: number;
	startDay: number;
	monthDays: number;
	displayMonth: string;
	marks: Map<number, string>;
	tableWidth: String

	constructor(public source: string, container: HTMLElement, public plugin: HabitTrackerPlugin) {
		super(container)
	}

	async onload () {
		this.parse(this.source);
		this.render();
	}
	parse(source: string) {
		this.startOfWeek = parseInt(this.plugin.settings.startOfWeek, 10);
		// month
		const m = source.match(/\[month:(.*?)\]/)
		if (m && m[1]) {
			const mon = moment(m[1]);
			this.displayMonth = mon.format(this.plugin.settings.monthFormat);
			this.startDay = mon.startOf('month').day();
			this.monthDays = mon.endOf('month').date();
		} else {
			throw new Error('Fail: Month not found. e.g. [2021-01-15]')
		}

		const wm = source.match(/\[width:(.*?)\]/)
		if (wm && wm[1]) {
			this.tableWidth = wm[1];
		}
		const dm = source.match(/\((.*?)\)/g)
		if (dm && dm.length) {
			const marks = new Map<number, string>()
			dm.forEach(t => {
				const m = t.match(/\((.*?)(,(.*?))?\)/)
				if (m) {
					const date = parseInt(m[1], 10)
					const tag = m[3]
					marks.set(date, tag);//[date] = tag
				}
			})
			this.marks = marks
		}
	}
	
	render () {
		const head = this.genHead();
		const body = this.genBody();
		const styles = this.tableWidth ? `width: ${this.tableWidth};` : ''
		this.containerEl.innerHTML = `<table class="habitt" style="${styles}">${head}${body}</table>`;
	}

	genHead () {
		const { Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday } = this.plugin.settings
		const WEEK = [Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday]
		const arr = ['<thead>']
		if (this.plugin.settings.displayHead) {
			arr.push(`<tr><th colspan="7" class="habitt-head">${this.displayMonth}</th></tr>`)
		}
		arr.push(`<tr>`)
		for (var i = 0; i < 7; i++) {
			arr.push(`<th class="habitt-th habitt-th-${i}">${WEEK[(i + this.startOfWeek) % 7]}</th>`)
		}
		arr.push('</tr>')
		arr.push('</thead>')
		return arr.join('')
	}

	genBody () {
		const startHolds = this.startDay >= this.startOfWeek ? this.startDay - this.startOfWeek : 7 - this.startOfWeek + this.startDay;
		let days = (new Array(this.monthDays)).fill(0).map((v, i) => i + 1)
		const weeks = []
		if (startHolds) {
			const startWeekDays = 7 - startHolds
			const firstWeek = (new Array(startHolds)).fill('')
			weeks.push(firstWeek.concat(days.slice(0, startWeekDays)))
			days = days.slice(startWeekDays)
		}
		let i = 0;
		while (i < days.length) {
			weeks.push(days.slice(i, i + 7))
			i = i + 7
		}
		const lastWeek = weeks[weeks.length - 1]
		if (lastWeek.length < 7) {
			const pad = 7 - lastWeek.length
			for (let i = 0; i < pad; i++) {
				lastWeek.push('')
			}
		}
		
		const html = ['<tbody>']
		for (let i = 0; i < weeks.length; i++) {
			html.push('<tr>')
			for (let j = 0; j < weeks[i].length; j++) {
				const d = weeks[i][j]
				const hasOwn = this.marks.has(d)
				const dot = hasOwn ? `<div>${this.marks.get(d) || '✔️'}</div>` : ''
				const cellContent = `<div class="habitt-c"><div class="habitt-date">${d}</div><div class="habitt-dots">${dot}</div></div>`
				html.push(`<td class="habitt-td habitt-td--${d || 'disabled'} ${hasOwn ? 'habitt-td--checked' : ''}">${cellContent}</td>`)
			}
			html.push('</tr>')
		}
		html.push('</tbody>')
		return html.join('')
	}
}

class HabitTrackerSettingTab extends PluginSettingTab {
	plugin: HabitTrackerPlugin;

	constructor(app: App, plugin: HabitTrackerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let {containerEl} = this;

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
