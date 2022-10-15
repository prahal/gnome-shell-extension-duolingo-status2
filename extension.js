const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Shell = imports.gi.Shell;
const Main = imports.ui.main;
const GLib = imports.gi.GLib;

const DuolingoUI = Me.imports.duolingoUI;
const Constants = Me.imports.constants;

const Gettext = imports.gettext;
const _ = Gettext.domain(Me.uuid).gettext;

function init() {
}

var menu;
var duolingo2PrefsIntervalId;
var duolingo2PrefsTimeoutId;

function enable() {
    menu = new DuolingoUI.DuolingoMenuButton();
    menu.custom_signals.connect(Constants.EVENT_REFRESH, function() {
        restart();
    });
    menu.custom_signals.connect(Constants.EVENT_PREFERENCES, function () {
        ExtensionUtils.openPrefs();

        if (duolingo2PrefsIntervalId) {
            GLib.source_remove(duolingo2PrefsIntervalId);
            duolingo2PrefsIntervalId = undefined;
        }
        duolingo2PrefsIntervalId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
            let appSys = Shell.AppSystem.get_default();
            let app = appSys.lookup_app('org.gnome.Shell.Extensions.desktop');
            if (!app) {
                return GLib.SOURCE_CONTINUE;
            }

            app.connect('windows_changed', function() {
                if (app.get_state() == Shell.AppState.STOPPED && menu.have_settings_been_changed() === true) {
                    menu.custom_signals.emit(Constants.EVENT_REFRESH);
                    Main.notify(_('The Duolingo extension just restarted.'));
                }
            });

            return GLib.SOURCE_REMOVE;
        });

        // disable the timer after  while
        duolingo2PrefsTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT,
          Constants.GRAB_PREFS_HANDLER_INTERVAL_TIMEOUT, () => {
            if (duolingo2PrefsIntervalId) {
                GLib.source_remove(duolingo2PrefsIntervalId);
                duolingo2PrefsIntervalId = undefined;
            }

            return GLib.SOURCE_REMOVE;
        });
    });
}

function disable() {
    menu.destroy();
    if (duolingo2PrefsIntervalId) {
        GLib.source_remove(duolingo2PrefsIntervalId);
        duolingo2PrefsIntervalId = undefined;
    }
    if (duolingo2PrefsTimeoutId) {
        GLib.source_remove(duolingo2PrefsTimeoutId);
        duolingo2PrefsTimeoutId = undefined;
    }
}

function restart() {
    disable();
    enable();
}
