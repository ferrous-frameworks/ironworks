var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var _ = require('lodash');
var IronBeam = require('iron-beam');
var EventEmitter = IronBeam.EventEmitter;
var Event = require('./Event');
var Options = require('../opts/Options');
var Eventer = (function (_super) {
    __extends(Eventer, _super);
    function Eventer(opts) {
        _super.call(this);
        var defOpts = {};
        this.opts = new Options(defOpts);
        this.opts.merge(opts);
        this.useOnce = false;
        this.event = "";
    }
    Eventer.prototype.getLastEvent = function () {
        return this.event;
    };
    Eventer.getListenMethodName = function (emitMethodName) {
        switch (emitMethodName) {
            case 'tell': return 'listen';
            case 'inform': return 'info';
            case 'confirm': return 'ack';
            case 'check': return 'verify';
            case 'ask': return 'answer';
            case 'request': return 'respond';
        }
    };
    Eventer.getEvent = function (event) {
        if (typeof event === 'string') {
            return new Event({
                name: event
            });
        }
        else if (!(event instanceof Event)) {
            return new Event(event);
        }
        return event;
    };
    Eventer.prototype.tell = function (event, anno) {
        var evt = Eventer.getEvent(event);
        if (!_.isUndefined(anno)) {
            _super.prototype.annotate.call(this, anno);
        }
        return _super.prototype.emit.call(this, evt.getText(), evt);
    };
    Eventer.prototype.inform = function (event, info, anno) {
        var evt = Eventer.getEvent(event);
        if (!_.isUndefined(anno)) {
            _super.prototype.annotate.call(this, anno);
        }
        return _super.prototype.emit.call(this, evt.getText(), evt, info);
    };
    Eventer.prototype.confirm = function (event, callback, anno) {
        var evt = Eventer.getEvent(event);
        if (!_.isUndefined(anno)) {
            _super.prototype.annotate.call(this, anno);
        }
        return _super.prototype.emit.call(this, evt.getText(), evt, callback);
    };
    Eventer.prototype.check = function (event, toCheck, callback, anno) {
        var evt = Eventer.getEvent(event);
        if (!_.isUndefined(anno)) {
            _super.prototype.annotate.call(this, anno);
        }
        return _super.prototype.emit.call(this, evt.getText(), evt, toCheck, callback);
    };
    Eventer.prototype.ask = function (event, callback, anno) {
        var evt = Eventer.getEvent(event);
        if (!_.isUndefined(anno)) {
            _super.prototype.annotate.call(this, anno);
        }
        return _super.prototype.emit.call(this, evt.getText(), evt, callback);
    };
    Eventer.prototype.request = function (event, request, callback, anno) {
        var evt = Eventer.getEvent(event);
        if (!_.isUndefined(anno)) {
            _super.prototype.annotate.call(this, anno);
        }
        return _super.prototype.emit.call(this, evt.getText(), evt, request, callback);
    };
    Eventer.prototype.listen = function (event, listener) {
        return this.setupListener(event, listener);
    };
    Eventer.prototype.info = function (event, listener) {
        return this.setupListener(event, listener);
    };
    Eventer.prototype.ack = function (event, listener) {
        return this.setupListener(event, listener);
    };
    Eventer.prototype.verify = function (event, listener) {
        return this.setupListener(event, listener);
    };
    Eventer.prototype.answer = function (event, listener) {
        return this.setupListener(event, listener);
    };
    Eventer.prototype.respond = function (event, listener) {
        return this.setupListener(event, listener);
    };
    Eventer.prototype.onlyOnce = function () {
        this.useOnce = true;
        return this;
    };
    Eventer.prototype.setupListener = function (event, listener) {
        var _this = this;
        var evt = Eventer.getEvent(event);
        if (this.useOnce) {
            this.useOnce = false;
            _super.prototype.once.call(this, evt.getText(), function (emit) {
                var args = [];
                for (var _i = 1; _i < arguments.length; _i++) {
                    args[_i - 1] = arguments[_i];
                }
                _this.callListener(listener, emit, args);
            });
        }
        else {
            _super.prototype.on.call(this, evt.getText(), function (emit) {
                var args = [];
                for (var _i = 1; _i < arguments.length; _i++) {
                    args[_i - 1] = arguments[_i];
                }
                _this.callListener(listener, emit, args);
            });
        }
        return this;
    };
    Eventer.prototype.callListener = function (listener, emit, args) {
        listener.apply(listener, args.concat(emit));
    };
    Eventer.prototype.setMaxListeners = function (max) {
        _super.prototype.setMaxListeners.call(this, max);
        return this;
    };
    Eventer.prototype.annotate = function (anno) {
        _super.prototype.annotate.call(this, anno);
        return this;
    };
    Eventer.prototype.on = function (event, method) {
        var evt = Eventer.getEvent(event);
        _super.prototype.on.call(this, evt.getText(), method);
        return this;
    };
    Eventer.prototype.addListener = function (event, method) {
        var evt = Eventer.getEvent(event);
        _super.prototype.addListener.call(this, evt.getText(), method);
        return this;
    };
    Eventer.prototype.once = function (event, method) {
        var evt = Eventer.getEvent(event);
        _super.prototype.once.call(this, evt.getText(), method);
        return this;
    };
    Eventer.prototype.removeListener = function (event, method) {
        var evt = Eventer.getEvent(event);
        _super.prototype.removeListener.call(this, evt.getText(), method);
        return this;
    };
    Eventer.prototype.removeAnnotatedListeners = function (event, anno) {
        var evt = Eventer.getEvent(event);
        _super.prototype.removeAnnotatedListeners.call(this, evt.getText(), anno);
        return this;
    };
    Eventer.prototype.removeAllListeners = function (event) {
        if (_.isUndefined(event)) {
            _super.prototype.removeAllListeners.call(this);
        }
        else {
            var evt = Eventer.getEvent(event);
            _super.prototype.removeAllListeners.call(this, evt.getText());
        }
        return this;
    };
    Eventer.prototype.removeAllAnnotatedListeners = function (anno, event) {
        if (_.isUndefined(event)) {
            _super.prototype.removeAllAnnotatedListeners.call(this, anno);
        }
        else {
            var evt = Eventer.getEvent(event);
            _super.prototype.removeAllAnnotatedListeners.call(this, anno, evt.getText());
        }
        return this;
    };
    Eventer.prototype.intercept = function (event, interceptors) {
        var evt = Eventer.getEvent(event);
        _super.prototype.intercept.call(this, evt.getText(), interceptors);
        return this;
    };
    Eventer.prototype.dispose = function (callback) {
        _super.prototype.dispose.call(this, callback);
    };
    return Eventer;
})(EventEmitter);
module.exports = Eventer;
//# sourceMappingURL=Eventer.js.map