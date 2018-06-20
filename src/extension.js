/* -*- mode: js; js-basic-offset: 4; indent-tabs-mode: nil -*- */

const AltTab = imports.ui.altTab;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Main = imports.ui.main;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
// const SwitcherPopup = imports.ui.switcherPopup;
const WindowManager = imports.ui.windowManager;

/**
 * @overview
 * AwesomeSwitcher v0.1.1
 * Caleb Webber
 * Originally authored by Yannik Sembritzki
 *
 * This extension adds the following features to alt-tab window switching
 * in gnome:
 * - Grid-Layout with multiple rows of windows instead of only one
 *   horizontally scrollable row
 * 
 *
 * This extension requires alternate-tab (https://extensions.gnome.org/extension/15/alternatetab/)
 * to be enabled.
 */

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
    global.log("Enabled extension");
    //[object GjsFileImporter]
    global.log("imports: " + imports);


    injections['AltTab.WindowIcon._init'] = AltTab.WindowIcon.prototype['_init'];
    AltTab.WindowIcon.prototype['_init'] = function(window, mode) {
        this.window = window;

        this.actor = new St.BoxLayout({ style_class: 'alt-tab-app',
                                        vertical: true });
        this._icon = new St.Widget({ layout_manager: new Clutter.BinLayout() });

        this.actor.add(this._icon, { x_fill: false, y_fill: false } );
        this.label = new St.Label({ text: window.get_title() });

        let tracker = Shell.WindowTracker.get_default();
        this.app = tracker.get_window_app(window);

        let mutterWindow = this.window.get_compositor_private();
        let size;

        this._icon.destroy_all_children();

        let scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
       // let scaleFactor = 1;
        global.log("Scalefactor: " + scaleFactor);

        switch (mode) {
            case AppIconMode.THUMBNAIL_ONLY:
                size = WINDOW_PREVIEW_SIZE;
                //this._icon.add_actor(_createWindowClone(mutterWindow, WINDOW_PREVIEW_SIZE));
                this._icon.add_actor(_createWindowClone(mutterWindow, size * scaleFactor));
                break;

            case AppIconMode.BOTH:
                size = AltTab.WINDOW_PREVIEW_SIZE;
                //size = 240;
                //this._icon.add_actor(_createWindowClone(mutterWindow, WINDOW_PREVIEW_SIZE));
                this._icon.add_actor(AltTab._createWindowClone(mutterWindow, size * scaleFactor));

                if (this.app)
                    this._icon.add_actor(this._createAppIcon(this.app,
                                                             APP_ICON_SIZE_SMALL));
                break;

            case AppIconMode.APP_ICON_ONLY:
                size = APP_ICON_SIZE;
                this._icon.add_actor(this._createAppIcon(this.app, size));
        }

        //this._icon.set_size(size, size);
        // 256 ofc.
        global.log("WindowIcon size: " + size*scaleFactor + "/" + size*scaleFactor)
        this._icon.set_size(size * scaleFactor, size * scaleFactor);
    };

    injections['SwitcherPopup.SwitcherList._allocate'] = SwitcherPopup.SwitcherList.prototype['_allocate'];
    SwitcherPopup.SwitcherList.prototype['_allocate'] = function (actor, box, flags) {
        // this is the height of the total popup. the default height with 2x scaling is 336
        // 
        let childHeight = box.y2 - box.y1;

        // default maxChildMin & maxChildNat -> with 2x scaling: 288
        let [maxChildMin, maxChildNat] = this._maxChildWidth(childHeight);
        // default with 2x scaling: 64 and 5 open windows (=4*16)
        //let totalSpacing = Math.max(this._list.spacing * (this._items.length - 1), 0);
        let totalSpacing = Math.max(this._list.spacing * (Math.min(this._items.length - 1, this._itemsPerRow())), 0);

        // default with 2x scaling: 288
        //let childWidth = Math.floor(Math.max(0, box.x2 - box.x1 - totalSpacing) / this._items.length);
        let childWidth = Math.floor(Math.max(0, box.x2 - box.x1 - totalSpacing) / Math.min(this._items.length, this._itemsPerRow()));

        //global.log("box.x2 - box.x1: " + (box.x2-box.x1) + " childHeight: " + childHeight + " maxChildMin: " + maxChildMin + " maxChildNat " + maxChildNat + " totalSpacing: " + totalSpacing + " childWidth: " + childWidth + " totalChildWidth: " + (box.x2 - box.x1) );

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
        //global.log("===========skipItems: " + skipItems);
        //global.log("================ highlighted: " + this._highlighted);
        //global.log("_allocate rows: " + rows + " selectedRow: " + selectedRow);
        let childCounter = 0;
        let orig_height = 0;
        for (let i = 0; i < children.length; i++) {
            if (this._items.indexOf(children[i]) != -1) {
                childCounter++;
                if (childCounter <= skipItems) {
                  children[i].hide();
                  continue;
                } else {
                  children[i].show();
                }
                  
                // default with 2x scaling and 5 open windows: 288, 288
                let [childMin, childNat] = children[i].get_preferred_height(childWidth);
                // default with 2x scaling and 5 open windows: 24 [=(336-288)/2)]
                //let vSpacing = (childHeight - childNat) / 2;
                let vSpacing = (childHeight - childNat * visibleRows) / 2;
                //global.log("childCounter: " + childCounter + " childMin: " + childMin + " childNat: " + childNat + " vSpacing: " + vSpacing + " this._list.spacing: " + this._list.spacing);
                childBox.x1 = x;
                // childBox.y1 = vSpacing;
                childBox.y1 = vSpacing + y;
                childBox.x2 = x + childWidth;
                // childBox.y2 = childBox.y1 + childNat;
                childBox.y2 = childBox.y1 + childNat;
                //global.log("x1: " + childBox.x1 + " y1: " + childBox.y1 + " x2: " + childBox.x2 + " y2: " + childBox.y2 + " x2-x1: " + (childBox.x2 - childBox.x1) + " y2-y1: " + (childBox.y2 - childBox.y1));
                
                children[i].allocate(childBox, flags);
            if (childCounter > 0 && (childCounter) % this._itemsPerRow() == 0) {
              //global.log("childCounter: " + childCounter + " i: " + i);
              y += childMin + this._list.spacing;
              x = 0;
            } else {
                x += childWidth + this._list.spacing;
            }
 
                //orig code
                //x += this._list.spacing + childWidth;
            } else {
                // Something else, eg, AppSwitcher's arrows;
                // we don't allocate it.
            }
        }
    };

    injections['SwitcherPopup.SwitcherList._getPreferredHeight'] = SwitcherPopup.SwitcherList.prototype['_getPreferredHeight'];
    SwitcherPopup.SwitcherList.prototype['_getPreferredHeight'] = function (actor, forWidth, alloc) {
        let maxChildMin = 0;
        let maxChildNat = 0;

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

        // new code by me
        //let rows = Math.ceil(this._items.length / this._itemsPerRow());
        let rows = this.visibleRows();
        maxChildMin = rows * maxChildMin + this._list.spacing * (rows - 1);
        maxChildNat = rows * maxChildNat + this._list.spacing * (rows - 1);
        // end new code
        // 288
        alloc.min_size = maxChildMin;
        // 288
        alloc.natural_size = maxChildNat;
        //global.log("[SwitcherList._getPreferredHeight] alloc.min_size: " + maxChildMin + " alloc.natural_size: " + maxChildNat);

    };


    //this method is used just for debugging purposes
    AltTab.WindowList.prototype['_getPreferredHeight'] = function(actor, forWidth, alloc) {
        //this.parent(actor, forWidth, alloc);
        SwitcherPopup.SwitcherList.prototype._getPreferredHeight.call(this, actor, forWidth, alloc)

        //24
        let spacing = this.actor.get_theme_node().get_padding(St.Side.BOTTOM);
        //labelMin=36, labelNat=36
        let [labelMin, labelNat] = this._label.get_preferred_height(-1);
        alloc.min_size += labelMin + spacing;
        alloc.natural_size += labelNat + spacing;

        // the following lines are Debugging WindowList._getPreferredHeight
        //global.log("[WindowList._getPreferredHeight] spacing: " + spacing + " labelMin: " + labelMin + " labelNat: " + labelNat + " alloc.min_size: " + alloc.min_size + " alloc.natural_size: " + alloc.natural_size);
    };

    injections['AltTab.WindowList._allocateTop'] = AltTab.WindowList.prototype._allocateTop;
    AltTab.WindowList.prototype._allocateTop = function(actor, box, flags) {
        let childBox = new Clutter.ActorBox();
        // position on the same space on x-achsis
        childBox.x1 = box.x1;
        childBox.x2 = box.x2;
        // position in the bottom-most position on y-achsis
        childBox.y2 = box.y2;
        childBox.y1 = childBox.y2 - this._label.height;
        this._label.allocate(childBox, flags);

        let spacing = this.actor.get_theme_node().get_padding(St.Side.BOTTOM);
        // allocate with box size reduced by label+spacing height
        box.y2 -= this._label.height + spacing;
        SwitcherPopup.SwitcherList.prototype._allocateTop.call(this, actor, box, flags);

    };

    injections['SwitcherPopup.SwitcherList._allocateTop'] = SwitcherPopup.SwitcherList.prototype._allocateTop;
    SwitcherPopup.SwitcherList.prototype._allocateTop = function(actor, box, flags) {
        let leftPadding = this.actor.get_theme_node().get_padding(St.Side.LEFT);
        let rightPadding = this.actor.get_theme_node().get_padding(St.Side.RIGHT);

        let childBox = new Clutter.ActorBox();
        let scrollable = this._minSize > box.x2 - box.x1;
        //24
        //box.y1 -= this.actor.get_theme_node().get_padding(St.Side.TOP);
        //24
        //box.y2 += this.actor.get_theme_node().get_padding(St.Side.BOTTOM);
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
       
        // width 2x scaling & 5 windows: 64
        //let totalSpacing = Math.max(this._list.spacing * (this._items.length - 1), 0);
        let totalSpacing = Math.max(this._list.spacing * Math.min(this._items.length - 1, this._itemsPerRow()), 0)
        //totalSpacing = 0;
        // with 2x scaling & 5 windows: 1504 (=5*288+64)
        //alloc.min_size = this._items.length * maxChildMin + totalSpacing;
        // setting this leads to a sudden decrease decrease in childWidth: each child is still child/totalChilds big even though
        // it should be child/Math.min(totalChilds, 5) -> fixed by correcting childWidth calculation in _allocate
        alloc.min_size = Math.min(this._items.length, this._itemsPerRow()) * maxChildMin + totalSpacing;
        alloc.natural_size = alloc.min_size;
        this._minSize = alloc.min_size;
        //global.log("totalSpacing: " + totalSpacing + " alloc.min_size = alloc.natural_size = this._minSize: " + alloc.min_size);
    };

    injections['AltTab.WindowList.highlight'] = AltTab.WindowList.prototype['highlight'];
    AltTab.WindowList.prototype['highlight'] = function(index, justOutline) {
        if (this.finished) {
            return;
        }
        //this.parent(index, justOutline);
        SwitcherPopup.SwitcherList.prototype.highlight.call(this, index, justOutline);

        this._label.set_text(index == -1 ? '' : this.icons[index].label.text);

        if (this.lastWindowState && this.lastWindowState.minimized) {
            this.icons[this.lastWindowState.index].window.minimize();
        }
        if (this.lastWindowState) {
            // uncomment for live preview
            // this.icons[this.lastWindowState.index].window.unmake_above();
            global.log("unmake_above: " + this.icons[this.lastWindowState.index].window.get_title())
        }
        let window = this.icons[index].window;
        this.lastWindowState = [];
        this.lastWindowState.index = index;
        this.lastWindowState.minimized = window.minimized;
        
        // uncomment for live preview
        // if (window.minimized) {
            // window.unminimize();
        // }

        // uncomment for live preview
        // global.log("make_above:" + window.get_title());

        // uncomment for live preview
        // window.make_above();
    };

    injections['SwitcherPopup.SwitcherPopup.destroy'] = SwitcherPopup.SwitcherPopup.prototype['destroy'];
    SwitcherPopup.SwitcherPopup.prototype['destroy'] = function() {
        if (this._items[this._selectedIndex].window.above) {
            this._items[this._selectedIndex].window.unmake_above();
            global.log("[SwitcherPoup.destroy] unmake_above: " + this._items[this._selectedIndex].window.get_title())
        }
        return injections['SwitcherPopup.SwitcherPopup.destroy'].call(this);
    };

    injections['WindowSwitcherPopup._init'] = AltTab.WindowSwitcherPopup.prototype['_init'];
    AltTab.WindowSwitcherPopup.prototype['_init'] = function() {
        Main.wm._blockAnimations = true;
        return injections['WindowSwitcherPopup._init'].call(this);
    };

    injections['WindowSwitcherPopup._finish'] = AltTab.WindowSwitcherPopup.prototype['_finish'];
    AltTab.WindowSwitcherPopup.prototype['_finish'] = function() {
        Main.wm._blockAnimations = false;
        this._switcherList.finished = true;

        global.log("_finish unmake_above: " + this._items[this._selectedIndex].window.get_title());

        this._items[this._selectedIndex].window.unmake_above();
        return injections['WindowSwitcherPopup._finish'].call(this);
    };

    injections['WindowSwitcherPopup._keyPressHandler'] = AltTab.WindowSwitcherPopup.prototype._keyPressHandler;
    AltTab.WindowSwitcherPopup.prototype._keyPressHandler = function(keysym, action) {
        if (keysym == Clutter.KEY_Up) {
            global.log("Press up key");
            this._select(this._previousRow());
            return Clutter.EVENT_STOP;
        } else if (keysym == Clutter.KEY_Down) {
            this._select(this._nextRow());

            global.log("Press down key");
            return Clutter.EVENT_STOP;
        }
        return injections['WindowSwitcherPopup._keyPressHandler'].call(this, keysym, action);
    };

    injections['SwitcherPopup.SwitcherPopup._select'] = SwitcherPopup.SwitcherPopup.prototype._select;
    SwitcherPopup.SwitcherPopup.prototype._select = function(num) {
        global.log("called select with num: " + num);
        return injections['SwitcherPopup.SwitcherPopup._select'].call(this, num);
    };

    AltTab.WindowSwitcherPopup.prototype._nextRow = function() {
        let rows = Math.ceil(this._items.length / this._itemsPerRow());
        let currentRow = Math.ceil((this._selectedIndex + 1) / this._itemsPerRow());
        global.log("================currentRow: " + currentRow + " rows: " + rows);
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
        return Math.min(Math.ceil(this._items.length / this._itemsPerRow()), AltTab.maxVisibleRows());
    };

    AltTab.maxVisibleRows = function() {
        return 3;
    };

    AltTab.itemsPerRow = function() {
        let disableRows = false;
        if (disableRows) {
            return 9999;
        }
        return AltTab.maxItemsPerRow();
    };
    
    AltTab.maxItemsPerRow = function() {
        return 6;
    };

    AltTab.WindowList.prototype._itemsPerRow = function() {
        return AltTab.itemsPerRow();
    };

    AltTab.WindowSwitcherPopup.prototype._itemsPerRow = function() {
        return AltTab.itemsPerRow();
    };

    AltTab.AppSwitcherPopup.prototype._itemsPerRow = function() {
        return AltTab.itemsPerRow();
    };
    
// Vererbung: 
// switcherPopup.SwitcherPopup -> [altTab.AppSwitcherPopup, altTab.WindowSwitcherPopup]
// switcherPopup.SwitcherList -> [altTab.AppSwitcher, altTab.ThumbnailList, altTab.WindowList]
// altTab -> AppIcon, WindowIcon

}

function disable() {
    global.log("Disable is being run");
    AltTab.WindowIcon.prototype['_init'] = injections['AltTab.WindowIcon._init'];
    SwitcherPopup.SwitcherList.prototype['_allocate'] = injections['SwitcherPopup.SwitcherList._allocate'];
    SwitcherPopup.SwitcherList.prototype['_getPreferredHeight'] = injections['SwitcherPopup.SwitcherList._getPreferredHeight'];
    AltTab.WindowList.prototype['_allocateTop'] = injections['AltTab.WindowList._allocateTop'];
    SwitcherPopup.SwitcherList.prototype['_allocateTop'] = injections['SwitcherPopup.SwitcherList._allocateTop'];
    SwitcherPopup.SwitcherList.prototype['_getPreferredWidth'] = injections['SwitcherPopup.SwitcherList._getPreferredWidth'];
    AltTab.WindowList.prototype['highlight'] = injections['AltTab.WindowList.highlight'];

    AltTab.WindowSwitcherPopup.prototype['_init'] = injections['WindowSwitcherPopup._init'];
    AltTab.WindowSwitcherPopup.prototype['_finish'] = injections['WindowSwitcherPopup._finish'];
    AltTab.WindowSwitcherPopup.prototype._keyPressHandler = injections['WindowSwitcherPopup._keyPressHandler'];
    SwitcherPopup.SwitcherPopup.prototype._select = injections['SwitcherPopup.SwitcherPopup._select'];
    SwitcherPopup.SwitcherPopup.prototype['destroy'] = injections['SwitcherPopup.SwitcherPopup.destroy'];

}
