const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;

const AwesomeSwitcherPrefWidget = GObject.registerClass(
class AwesomeSwitcherPrefWidget extends Gtk.Grid {
    _init(params) {
        super._init(params);
        this.margin = 24;
        this.row_spacing = 6;
        this.orientation = Gtk.Orientation.VERTICAL;

        this._settings = new Gio.Settings({ schema_id: 'org.gnome.shell.extensions.awesomeswitcher' });

        let itemsPerRowLabel = 'Items per row';
        this.add(new Gtk.Label({ label: itemsPerRowLabel, use_markup: false,
                                 halign: Gtk.Align.START }));

        let align = new Gtk.Alignment({ left_padding: 12 });
        this.add(align);

        let grid = new Gtk.Grid({ orientation: Gtk.Orientation.VERTICAL,
                                  row_spacing: 6,
                                  column_spacing: 6 });
        align.add(grid);

        let spinnerAdjustment = new Gtk.Adjustment({
            lower: 1,
            upper: 10,
            step_increment: 1
        });
        
        spinnerAdjustment.value = this._settings.get_int('items-per-row');

        let itemsPerRowSpinner = new Gtk.SpinButton({adjustment: spinnerAdjustment, climb_rate: 1, digits: 0});
        
        itemsPerRowSpinner.connect('value-changed', spinner => {
            this._settings.set_int('items-per-row', spinner.value);
        });

        this.add(itemsPerRowSpinner);
    }
});
function init() {

}
function buildPrefsWidget() {
    let widget = new AwesomeSwitcherPrefWidget();
    widget.show_all();

    return widget;
}
