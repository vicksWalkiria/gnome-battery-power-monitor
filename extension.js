'use strict';

const { GObject, St, Clutter, GLib, Gio } = imports.gi;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const ByteArray = imports.byteArray;

const UUID = 'battery-power@vant';
const REFRESH_SECONDS = 5;
const HISTORY_SIZE = 6; // ~30s rolling window for stable time estimate

function readSysfsString(path) {
    try {
        const [ok, contents] = GLib.file_get_contents(path);
        if (!ok || !contents)
            return null;
        return ByteArray.toString(contents).trim();
    } catch (_e) {
        return null;
    }
}

function readSysfsNumber(path) {
    const raw = readSysfsString(path);
    if (raw === null)
        return null;
    const val = Number(raw);
    return Number.isFinite(val) ? val : null;
}

function findBatteryPath() {
    const base = '/sys/class/power_supply';
    try {
        const dir = Gio.File.new_for_path(base);
        const enumerator = dir.enumerate_children(
            'standard::name',
            Gio.FileQueryInfoFlags.NONE,
            null
        );
        let info;
        while ((info = enumerator.next_file(null)) !== null) {
            const name = info.get_name();
            if (name.startsWith('BAT'))
                return `${base}/${name}`;
        }
    } catch (_e) {
        // fallback below
    }
    return '/sys/class/power_supply/BAT0';
}

function formatDuration(hours) {
    if (!Number.isFinite(hours) || hours <= 0 || hours > 99)
        return '--';
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h === 0)
        return `${m}m`;
    return `${h}h ${m < 10 ? '0' : ''}${m}m`;
}

function formatWatts(w) {
    return `${w.toFixed(1).replace('.', ',')} W`;
}

const BatteryPowerIndicator = GObject.registerClass(
class BatteryPowerIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.5, 'Battery Power Monitor', false);

        this._batPath = findBatteryPath();
        this._powerSamples = [];
        this._lastStatus = null;
        this._timeoutId = 0;

        // Top-bar widget
        const box = new St.BoxLayout({
            style_class: 'battery-power-box',
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._icon = new St.Icon({
            icon_name: 'battery-good-symbolic',
            style_class: 'system-status-icon battery-power-icon',
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._label = new St.Label({
            text: '... W',
            style_class: 'battery-power-label battery-power-low',
            y_align: Clutter.ActorAlign.CENTER,
        });

        box.add_child(this._icon);
        box.add_child(this._label);
        this.add_child(box);

        // Popup menu details
        this._statusItem = this._createInfoItem('Estado', '--');
        this._instantItem = this._createInfoItem('Consumo actual', '--');
        this._avgItem = this._createInfoItem('Media (30 s)', '--');
        this._timeItem = this._createInfoItem('Tiempo estimado', '--');
        this._energyItem = this._createInfoItem('Carga restante', '--');
        this._healthItem = this._createInfoItem('Salud batería', '--');

        this.menu.addMenuItem(this._statusItem.item);
        this.menu.addMenuItem(this._instantItem.item);
        this.menu.addMenuItem(this._avgItem.item);
        this.menu.addMenuItem(this._timeItem.item);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(this._energyItem.item);
        this.menu.addMenuItem(this._healthItem.item);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const refreshItem = new PopupMenu.PopupMenuItem('Actualizar ahora');
        refreshItem.connect('activate', () => this._update());
        this.menu.addMenuItem(refreshItem);

        // Initial read + periodic timer
        this._update();
        this._timeoutId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT_IDLE,
            REFRESH_SECONDS,
            () => {
                this._update();
                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    _createInfoItem(title, initialValue) {
        const item = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        const titleLabel = new St.Label({
            text: title,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        const valueLabel = new St.Label({
            text: initialValue,
            style_class: 'battery-power-menu-value',
            y_align: Clutter.ActorAlign.CENTER,
        });
        item.add_child(titleLabel);
        item.add_child(valueLabel);
        return { item, valueLabel };
    }

    _readBatteryData() {
        const p = this._batPath;
        const status = readSysfsString(`${p}/status`) || 'Unknown';
        const capacity = readSysfsNumber(`${p}/capacity`);
        const voltageNow = readSysfsNumber(`${p}/voltage_now`);
        const voltageDesign = readSysfsNumber(`${p}/voltage_min_design`) || voltageNow;

        let powerW = null;
        let currentA = null;
        let energyNowWh = null;
        let energyFullWh = null;
        let energyDesignWh = null;

        const powerNowUw = readSysfsNumber(`${p}/power_now`);
        const currentNowUa = readSysfsNumber(`${p}/current_now`);

        if (powerNowUw !== null) {
            powerW = Math.abs(powerNowUw) / 1e6;
            if (voltageNow && voltageNow > 0)
                currentA = powerW / (voltageNow / 1e6);
        } else if (currentNowUa !== null && voltageNow !== null) {
            currentA = Math.abs(currentNowUa) / 1e6;
            powerW = currentA * (voltageNow / 1e6);
        }

        const energyNowUw = readSysfsNumber(`${p}/energy_now`);
        const energyFullUw = readSysfsNumber(`${p}/energy_full`);
        const energyDesignUw = readSysfsNumber(`${p}/energy_full_design`);

        if (energyNowUw !== null && energyFullUw !== null) {
            energyNowWh = energyNowUw / 1e6;
            energyFullWh = energyFullUw / 1e6;
            energyDesignWh = energyDesignUw !== null ? energyDesignUw / 1e6 : null;
        } else {
            const chargeNowUa = readSysfsNumber(`${p}/charge_now`);
            const chargeFullUa = readSysfsNumber(`${p}/charge_full`);
            const chargeDesignUa = readSysfsNumber(`${p}/charge_full_design`);
            const vRef = (voltageDesign || 15200000) / 1e6;
            if (chargeNowUa !== null)
                energyNowWh = (chargeNowUa / 1e6) * vRef;
            if (chargeFullUa !== null)
                energyFullWh = (chargeFullUa / 1e6) * vRef;
            if (chargeDesignUa !== null)
                energyDesignWh = (chargeDesignUa / 1e6) * vRef;
        }

        return {
            status,
            capacity,
            voltageV: voltageNow !== null ? voltageNow / 1e6 : null,
            currentA,
            powerW,
            energyNowWh,
            energyFullWh,
            energyDesignWh,
        };
    }

    _setColorClass(cls) {
        this._label.remove_style_class_name('battery-power-low');
        this._label.remove_style_class_name('battery-power-med');
        this._label.remove_style_class_name('battery-power-high');
        this._label.remove_style_class_name('battery-power-charging');
        this._label.add_style_class_name(cls);
    }

    _update() {
        const d = this._readBatteryData();

        if (d.status !== this._lastStatus) {
            this._powerSamples = [];
            this._lastStatus = d.status;
        }

        if (d.powerW !== null && d.powerW > 0.1) {
            this._powerSamples.push(d.powerW);
            if (this._powerSamples.length > HISTORY_SIZE)
                this._powerSamples.shift();
        }

        const avgPowerW = this._powerSamples.length > 0
            ? this._powerSamples.reduce((a, b) => a + b, 0) / this._powerSamples.length
            : d.powerW;

        let timeText = '--';
        let statusEs = d.status;

        if (d.status === 'Discharging') {
            statusEs = 'Descargando';
            if (avgPowerW && avgPowerW > 0.3 && d.energyNowWh !== null)
                timeText = formatDuration(d.energyNowWh / avgPowerW);

            const wText = d.powerW !== null ? formatWatts(d.powerW) : '-- W';
            this._label.set_text(`${wText} · ${timeText}`);

            if (d.capacity !== null && d.capacity <= 20)
                this._icon.set_icon_name('battery-caution-symbolic');
            else if (d.capacity !== null && d.capacity <= 45)
                this._icon.set_icon_name('battery-low-symbolic');
            else
                this._icon.set_icon_name('battery-good-symbolic');

            if (d.powerW !== null && d.powerW >= 14.0)
                this._setColorClass('battery-power-high');
            else if (d.powerW !== null && d.powerW >= 9.5)
                this._setColorClass('battery-power-med');
            else
                this._setColorClass('battery-power-low');
        } else if (d.status === 'Charging') {
            statusEs = 'Cargando';
            if (avgPowerW && avgPowerW > 0.3 && d.energyFullWh !== null && d.energyNowWh !== null) {
                const remainingWh = Math.max(0, d.energyFullWh - d.energyNowWh);
                timeText = formatDuration(remainingWh / avgPowerW);
            }
            const wText = d.powerW !== null ? `+${formatWatts(d.powerW)}` : 'Cargando';
            this._label.set_text(`${wText} · ${timeText}`);
            this._icon.set_icon_name('battery-good-charging-symbolic');
            this._setColorClass('battery-power-charging');
        } else {
            statusEs = d.status === 'Full' ? 'Completa (AC)' : 'Conectado (AC)';
            const pct = d.capacity !== null ? `${d.capacity}%` : '';
            this._label.set_text(`AC${pct ? ' · ' + pct : ''}`);
            this._icon.set_icon_name('battery-full-charged-symbolic');
            this._setColorClass('battery-power-charging');
            timeText = 'Enchufado';
        }

        // Update popup menu labels
        this._statusItem.valueLabel.set_text(statusEs);

        if (d.powerW !== null) {
            const extra = (d.currentA !== null && d.voltageV !== null)
                ? ` (${d.currentA.toFixed(2)} A · ${d.voltageV.toFixed(1)} V)`
                : '';
            this._instantItem.valueLabel.set_text(`${formatWatts(d.powerW)}${extra}`);
        } else {
            this._instantItem.valueLabel.set_text('--');
        }

        this._avgItem.valueLabel.set_text(avgPowerW !== null ? formatWatts(avgPowerW) : '--');
        this._timeItem.valueLabel.set_text(
            d.status === 'Charging' && timeText !== '--' ? `${timeText} para 100%` : timeText
        );

        if (d.energyNowWh !== null && d.energyFullWh !== null) {
            const pctStr = d.capacity !== null ? ` (${d.capacity}%)` : '';
            this._energyItem.valueLabel.set_text(
                `${d.energyNowWh.toFixed(1)} / ${d.energyFullWh.toFixed(1)} Wh${pctStr}`
            );
        }

        if (d.energyFullWh !== null && d.energyDesignWh !== null && d.energyDesignWh > 0) {
            const health = (d.energyFullWh / d.energyDesignWh) * 100;
            this._healthItem.valueLabel.set_text(
                `${health.toFixed(1)}% (${d.energyFullWh.toFixed(1)} / ${d.energyDesignWh.toFixed(1)} Wh)`
            );
        }
    }

    destroy() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
        super.destroy();
    }
});

let _indicator = null;

function init() {
}

function enable() {
    _indicator = new BatteryPowerIndicator();
    // Place in the center box, right next to the clock & notifications indicator
    Main.panel.addToStatusArea(UUID, _indicator, 1, 'center');
}

function disable() {
    if (_indicator) {
        _indicator.destroy();
        _indicator = null;
    }
}
