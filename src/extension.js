/* -*- mode: js; js-basic-offset: 4; indent-tabs-mode: nil -*- */
const Gio = imports.gi.Gio;
const Clutter = imports.gi.Clutter;
const Shell = imports.gi.Shell;
const St = imports.gi.St;

const AltTab = imports.ui.altTab;
const Main = imports.ui.main;
const SwitcherPopup = imports.ui.switcherPopup;
const WindowManager = imports.ui.windowManager;

let settings = new Gio.Settings({ schema_id: 'org.gnome.shell.extensions.awesomeswitcher' });

const ITEMS_PER_ROW = settings.get_int('items-per-row') >= 1 ? settings.get_int('items-per-row') : 8;
const MAX_VISIBLE_ROWS = 4;

//const WINDOW_PREVIEW_SIZE = 300;
const APP_ICON_SIZE = 96;
const APP_ICON_SIZE_SMALL = 48;

const AppIconMode = {
    THUMBNAIL_ONLY: 1,
    APP_ICON_ONLY: 2,
    BOTH: 3,
};

let injections = {};

function init(metadata) {
}

function enable() {
    injections['SwitcherPopup.SwitcherList._allocate'] = SwitcherPopup.SwitcherList.prototype['_allocate'];
    SwitcherPopup.SwitcherList.prototype['_allocate'] = function (actor, box, flags) {
        let childHeight = box.y2 - box.y1;

        let [maxChildMin, maxChildNat] = this._maxChildWidth(childHeight);
        let totalSpacing = Math.max(this._list.spacing * (Math.min(this._items.length - 1, this._itemsPerRow())), 0);

        let childWidth = Math.floor(Math.max(0, box.x2 - box.x1 - totalSpacing) / Math.min(this._items.length, this._itemsPerRow()));


        let x = 0;
        let children = this._list.get_children();
        let childBox = new Clutter.ActorBox();
        let y = 0;

        let primary = Main.layoutManager.primaryMonitor;
        let parentRightPadding = this.actor.get_parent().get_theme_node().get_padding(St.Side.RIGHT);
        
        let rows = Math.ceil(this._items.length / this._itemsPerRow());
        let visibleRows = this.visibleRows();
        let visibleChilds = visibleRows * this._itemsPerRow();
        let selectedRow = Math.ceil((this._highlighted + 1)/ this._itemsPerRow());
        childHeight -= this._list.spacing * (visibleRows - 1);
        let skipItems = 0;
        if (selectedRow > visibleRows) {
          skipItems = (selectedRow - visibleRows) * this._itemsPerRow();
        }

        let childCounter = 0;
        let orig_height = 0;
        for (let i = 0; i < children.length; i++) {
            if (this._items.indexOf(children[i]) != -1) {
                childCounter++;
                if (childCounter <= skipItems) {
                  children[i].hide();
                  continue;
                } 
                else {
                  children[i].show();
                }
                  
                let [childMin, childNat] = children[i].get_preferred_height(childWidth);
                let vSpacing = (childHeight - childNat * visibleRows) / 2;
                childBox.x1 = x;
                childBox.y1 = vSpacing + y;
                childBox.x2 = x + childWidth;
                childBox.y2 = childBox.y1 + childNat;
                
                children[i].allocate(childBox, flags);
                if (childCounter > 0 && (childCounter) % this._itemsPerRow() == 0) {
                y += childMin + this._list.spacing;
                x = 0;
                } 
                else {
                    x += childWidth + this._list.spacing;
                }
            } 
            else {
                // Something else, eg, AppSwitcher's arrows;
                // we don't allocate it.
            }
        }
    }; // SwitcherPopup.SwitcherList.prototype['_allocate']

    injections['SwitcherPopup.SwitcherList._getPreferredHeight'] = SwitcherPopup.SwitcherList.prototype['_getPreferredHeight'];
    SwitcherPopup.SwitcherList.prototype['_getPreferredHeight'] = function (actor, forWidth, alloc) {
        let maxChildMin = 0,
            maxChildNat = 0;

        for (let i = 0; i < this._items.length; i++) {
            let [childMin, childNat] = this._items[i].get_preferred_height(-1);
            maxChildMin = Math.max(childMin, maxChildMin);
            maxChildNat = Math.max(childNat, maxChildNat);
        }

        if (this._squareItems) {
            let [childMin, childNat] = this._maxChildWidth(-1);
            maxChildMin = Math.max(childMin, maxChildMin);
            maxChildNat = maxChildMin;
        }

        // awesome switcher
        let rows = this.visibleRows();
        maxChildMin = rows * maxChildMin + this._list.spacing * (rows - 1);
        maxChildNat = rows * maxChildNat + this._list.spacing * (rows - 1);

        alloc.min_size = maxChildMin;
        alloc.natural_size = maxChildNat;
    }; // SwitcherPopup.SwitcherList.prototype['_getPreferredHeight']

    injections['SwitcherPopup.SwitcherList._allocateTop'] = SwitcherPopup.SwitcherList.prototype._allocateTop;
    SwitcherPopup.SwitcherList.prototype._allocateTop = function(actor, box, flags) {
        let leftPadding = this.actor.get_theme_node().get_padding(St.Side.LEFT);
        let rightPadding = this.actor.get_theme_node().get_padding(St.Side.RIGHT);

        let childBox = new Clutter.ActorBox();
        let scrollable = this._minSize > box.x2 - box.x1;

        this._scrollView.allocate(box, flags);

        let arrowWidth = Math.floor(leftPadding / 3);
        let arrowHeight = arrowWidth * 2;
        childBox.x1 = leftPadding / 2;
        childBox.y1 = this.actor.height / 2 - arrowWidth;
        childBox.x2 = childBox.x1 + arrowWidth;
        childBox.y2 = childBox.y1 + arrowHeight;
        this._leftArrow.allocate(childBox, flags);
        this._leftArrow.opacity = (this._scrollableLeft && scrollable) ? 255 : 0;

        arrowWidth = Math.floor(rightPadding / 3);
        arrowHeight = arrowWidth * 2;
        childBox.x1 = this.actor.width - arrowWidth - rightPadding / 2;
        childBox.y1 = this.actor.height / 2 - arrowWidth;
        childBox.x2 = childBox.x1 + arrowWidth;
        childBox.y2 = childBox.y1 + arrowHeight;
        this._rightArrow.allocate(childBox, flags);
        this._rightArrow.opacity = (this._scrollableRight && scrollable) ? 255 : 0;
    };

    injections['SwitcherPopup.SwitcherList._getPreferredWidth'] = SwitcherPopup.SwitcherList.prototype._getPreferredWidth;
    SwitcherPopup.SwitcherList.prototype['_getPreferredWidth'] = function (actor, forHeight, alloc) {
        let [maxChildMin, maxChildNat] = this._maxChildWidth(forHeight);
       
        let totalSpacing = Math.max(this._list.spacing * Math.min(this._items.length - 1, this._itemsPerRow()), 0)
        alloc.min_size = Math.min(this._items.length, this._itemsPerRow()) * maxChildMin + totalSpacing;
        alloc.natural_size = alloc.min_size;
        this._minSize = alloc.min_size;
    };

   

    injections['WindowSwitcherPopup._keyPressHandler'] = AltTab.WindowSwitcherPopup.prototype._keyPressHandler;
    AltTab.WindowSwitcherPopup.prototype._keyPressHandler = function(keysym, action) {
        if (keysym == Clutter.KEY_Up) {
            this._select(this._previousRow());
            return Clutter.EVENT_STOP;
        } else if (keysym == Clutter.KEY_Down) {
            this._select(this._nextRow());
            return Clutter.EVENT_STOP;
        }
        return injections['WindowSwitcherPopup._keyPressHandler'].call(this, keysym, action);
    };

    injections['SwitcherPopup.SwitcherPopup._select'] = SwitcherPopup.SwitcherPopup.prototype._select;
    SwitcherPopup.SwitcherPopup.prototype._select = function(num) {
        return injections['SwitcherPopup.SwitcherPopup._select'].call(this, num);
    };

    AltTab.WindowSwitcherPopup.prototype._nextRow = function() {
        let rows = Math.ceil(this._items.length / this._itemsPerRow());
        let currentRow = Math.ceil((this._selectedIndex + 1) / this._itemsPerRow());
        if (this._selectedIndex + this._itemsPerRow() > (this._items.length - 1) && currentRow < rows) {
            return this._items.length - 1;
        }
        if (this._selectedIndex + this._itemsPerRow() > this._items.length) {
            return 0;
        }
        return SwitcherPopup.mod(this._selectedIndex + this._itemsPerRow(), this._items.length);
    };

    AltTab.WindowSwitcherPopup.prototype._previousRow = function() {
        return SwitcherPopup.mod(this._selectedIndex - this._itemsPerRow(), this._items.length);
    };

    SwitcherPopup.SwitcherList.prototype.visibleRows = function() {
        return Math.min(Math.ceil(this._items.length / this._itemsPerRow()), SwitcherPopup.maxVisibleRows());
    };

    SwitcherPopup.maxVisibleRows = function() {
        return MAX_VISIBLE_ROWS;
    };

    SwitcherPopup.itemsPerRow = function() {
        let disableRows = false;
        if (disableRows) {
            return 9999;
        }
        return ITEMS_PER_ROW;
    };

    SwitcherPopup.SwitcherPopup.prototype._itemsPerRow = function () {
        return SwitcherPopup.itemsPerRow();
    }
    SwitcherPopup.SwitcherList.prototype._itemsPerRow = function () {
        return SwitcherPopup.itemsPerRow();
    };
} // function enable()

function disable() {
    SwitcherPopup.SwitcherList.prototype['_allocate'] = injections['SwitcherPopup.SwitcherList._allocate'];
    SwitcherPopup.SwitcherList.prototype['_getPreferredHeight'] = injections['SwitcherPopup.SwitcherList._getPreferredHeight'];
    SwitcherPopup.SwitcherList.prototype['_allocateTop'] = injections['SwitcherPopup.SwitcherList._allocateTop'];
    SwitcherPopup.SwitcherList.prototype['_getPreferredWidth'] = injections['SwitcherPopup.SwitcherList._getPreferredWidth'];

    AltTab.WindowSwitcherPopup.prototype._keyPressHandler = injections['WindowSwitcherPopup._keyPressHandler'];
    SwitcherPopup.SwitcherPopup.prototype._select = injections['SwitcherPopup.SwitcherPopup._select'];
}
