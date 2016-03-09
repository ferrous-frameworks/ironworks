///<reference path='../typings/master.d.ts'/>
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var _ = require('lodash');
var idHelper = require('../helpers/idHelper');
var CommEvent = require('./CommEvent');
var CommEmit = require('../eventing/CommEmit');
var Eventer = require('./Eventer');
var Comm = (function (_super) {
    __extends(Comm, _super);
    function Comm(service, whoAmI, serviceWorkerName, opts) {
        _super.call(this);
        this.whoService = service;
        this.serviceWorkerName = serviceWorkerName;
        var defOpts = {
            prefix: 'comm'
        };
        this.opts = this.opts.beAdoptedBy(defOpts, 'eventer');
        this.opts.merge(opts);
        this.me = whoAmI;
    }
    Comm.prototype.prefix = function () {
        return this.opts.get('prefix');
    };
    Comm.prototype.allCommListeners = function () {
        return _.map(this.allListeners(), function (l) {
            return {
                event: l.event,
                annotation: l.annotation,
                method: l.method,
                onlyOnce: l.onlyOnce,
                commEvent: new CommEvent(l.event)
            };
        });
    };
    Comm.prototype.getCommEvent = function (event, method) {
        if (typeof event === 'string') {
            var split = event.split('.').reverse();
            var evt = {
                prefix: _.isUndefined(split[4]) ? this.prefix() : split[4],
                service: _.isUndefined(split[3]) ? this.whoService.name : split[3],
                method: _.isUndefined(split[2]) ? method : split[2],
                worker: _.isUndefined(split[1]) ? this.serviceWorkerName : split[1],
                name: split[0]
            };
            return new CommEvent(evt);
        }
        else if (!(event instanceof CommEvent)) {
            return new CommEvent(event);
        }
        return event;
    };
    Comm.prototype.getEmit = function (event, method) {
        var evt = this.getCommEvent(event, method);
        var emit = event;
        return new CommEmit({
            id: _.isUndefined(emit.id) ? idHelper.newId() : emit.id,
            emitter: _.isUndefined(emit.emitter) ? this.me : emit.emitter,
            scoc: _.isUndefined(emit.scoc) ? [this.whoService] : emit.scoc,
            timestamp: _.isUndefined(emit.timestamp) ? new Date().getTime() : emit.timestamp,
            prefix: evt.prefix,
            service: evt.service,
            method: evt.method,
            worker: evt.worker,
            name: evt.name
        });
    };
    Comm.prototype.tell = function (event, anno) {
        var emit = this.getEmit(event, 'tell');
        return _super.prototype.tell.call(this, emit, anno);
    };
    Comm.prototype.inform = function (event, info, anno) {
        var emit = this.getEmit(event, 'inform');
        return _super.prototype.inform.call(this, emit, info, anno);
    };
    Comm.prototype.confirm = function (event, callback, anno) {
        var emit = this.getEmit(event, 'confirm');
        return _super.prototype.confirm.call(this, emit, callback, anno);
    };
    Comm.prototype.check = function (event, toCheck, callback, anno) {
        var emit = this.getEmit(event, 'check');
        return _super.prototype.check.call(this, emit, toCheck, callback, anno);
    };
    Comm.prototype.ask = function (event, callback, anno) {
        var emit = this.getEmit(event, 'ask');
        return _super.prototype.ask.call(this, emit, callback, anno);
    };
    Comm.prototype.request = function (event, request, callback, anno) {
        var emit = this.getEmit(event, 'request');
        return _super.prototype.request.call(this, emit, request, callback, anno);
    };
    Comm.prototype.listen = function (event, listener) {
        var evt = this.getCommEvent(event, 'tell');
        _super.prototype.listen.call(this, evt, listener);
        return this;
    };
    Comm.prototype.info = function (event, listener) {
        var evt = this.getCommEvent(event, 'inform');
        _super.prototype.info.call(this, evt, listener);
        return this;
    };
    Comm.prototype.ack = function (event, listener) {
        var evt = this.getCommEvent(event, 'confirm');
        _super.prototype.ack.call(this, evt, listener);
        return this;
    };
    Comm.prototype.verify = function (event, listener) {
        var evt = this.getCommEvent(event, 'check');
        _super.prototype.verify.call(this, evt, listener);
        return this;
    };
    Comm.prototype.answer = function (event, listener) {
        var evt = this.getCommEvent(event, 'ask');
        _super.prototype.answer.call(this, evt, listener);
        return this;
    };
    Comm.prototype.respond = function (event, listener) {
        var evt = this.getCommEvent(event, 'request');
        _super.prototype.respond.call(this, evt, listener);
        return this;
    };
    Comm.prototype.onlyOnce = function () {
        _super.prototype.onlyOnce.call(this);
        return this;
    };
    Comm.prototype.setMaxListeners = function (max) {
        _super.prototype.setMaxListeners.call(this, max);
        return this;
    };
    Comm.prototype.annotate = function (anno) {
        _super.prototype.annotate.call(this, anno);
        return this;
    };
    Comm.prototype.on = function (event, method) {
        var evt = this.getCommEvent(event);
        _super.prototype.on.call(this, evt.getText(), method);
        return this;
    };
    Comm.prototype.addListener = function (event, method) {
        var evt = this.getCommEvent(event);
        _super.prototype.addListener.call(this, evt.getText(), method);
        return this;
    };
    Comm.prototype.once = function (event, method) {
        var evt = this.getCommEvent(event);
        _super.prototype.once.call(this, evt.getText(), method);
        return this;
    };
    Comm.prototype.emit = function (event) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        var evt = this.getCommEvent(event);
        return _super.prototype.emit.apply(this, [evt.getText()].concat(args));
    };
    Comm.prototype.removeListener = function (event, method) {
        var evt = this.getCommEvent(event);
        _super.prototype.removeListener.call(this, evt.getText(), method);
        return this;
    };
    Comm.prototype.removeAnnotatedListeners = function (event, anno) {
        var evt = this.getCommEvent(event);
        _super.prototype.removeAnnotatedListeners.call(this, evt.getText(), anno);
        return this;
    };
    Comm.prototype.removeAllListeners = function (event) {
        var _this = this;
        if (!_.isUndefined(event)) {
            _super.prototype.removeAllListeners.call(this, this.getCommEvent(event).getText());
        }
        else {
            _.each(this.allCommListeners(), function (l) {
                _super.prototype.removeAllListeners.call(_this, _this.getCommEvent(l.commEvent).getText());
            });
        }
        return this;
    };
    Comm.prototype.removeAllAnnotatedListeners = function (anno, event) {
        var _this = this;
        if (!_.isUndefined(event)) {
            _super.prototype.removeAllAnnotatedListeners.call(this, anno, this.getCommEvent(event).getText());
        }
        else {
            _.each(this.allCommListeners(), function (l) {
                _super.prototype.removeAllAnnotatedListeners.call(_this, anno, _this.getCommEvent(l.commEvent).getText());
            });
        }
        return this;
    };
    Comm.prototype.listeners = function (event) {
        var evt = this.getCommEvent(event);
        return _.pluck(_super.prototype.listeners.call(this, evt.getText()), 'method');
    };
    Comm.prototype.hasListener = function (event, method) {
        var evt = this.getCommEvent(event, method);
        return _super.prototype.hasListener.call(this, evt.getText());
    };
    Comm.prototype.annotatedListeners = function (event, anno) {
        var evt = this.getCommEvent(event);
        return _super.prototype.annotatedListeners.call(this, evt.getText(), anno);
    };
    Comm.prototype.allAnnotatedListeners = function (anno, event) {
        if (!_.isUndefined(event)) {
            return _super.prototype.allAnnotatedListeners.call(this, anno, this.getCommEvent(event).getText());
        }
        return _super.prototype.allAnnotatedListeners.call(this, anno);
    };
    Comm.prototype.intercept = function (event, interceptors) {
        var evt = this.getCommEvent(event);
        _super.prototype.intercept.call(this, evt, interceptors);
        return this;
    };
    Comm.prototype.dispose = function (callback) {
        _super.prototype.dispose.call(this, callback);
    };
    return Comm;
})(Eventer);
module.exports = Comm;
//# sourceMappingURL=Comm.js.map