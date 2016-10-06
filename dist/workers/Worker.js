"use strict";
var _ = require('lodash');
var idHelper = require('../helpers/idHelper');
var Options = require('../opts/Options');
var CommEmit = require('../eventing/CommEmit');
var CommEvent = require('../eventing/CommEvent');
var Collection = require('../collection/Collection');
var Worker = (function () {
    function Worker(dependencyNames, whoAmI, opts) {
        var _this = this;
        var defOpts = {
            dependencies: []
        };
        this.opts = new Options(defOpts);
        this.opts.merge(_.isUndefined(opts) ? void 0 : opts.worker);
        var deps = this.opts.get('dependencies');
        deps = deps.concat(dependencyNames);
        this.dependencies = new Collection(idHelper.newId());
        _.each(deps, function (depDef) {
            if (_.isString(depDef)) {
                _this.addDependency(depDef, false);
            }
            else {
                _this.addDependency(depDef.name, !_.isUndefined(depDef.optional) && depDef.optional);
            }
        });
        this.me = whoAmI;
        this.useOnce = false;
        this.inited = false;
        this.preStarted = false;
        this.started = false;
    }
    Worker.prototype.addDependency = function (name, optional) {
        this.dependencies.add({
            me: {
                id: idHelper.newId(),
                name: name
            },
            optional: optional
        });
    };
    Worker.prototype.preInit = function (comm, whoService, callback) {
        this.comm = comm;
        this.whoService = whoService;
        this.tellWorkflowStep('pre-inited');
        if (!_.isUndefined(callback)) {
            process.nextTick(function () {
                callback(null);
            });
        }
        return this;
    };
    Worker.prototype.init = function (callback) {
        this.tellWorkflowStep('inited');
        this.inited = true;
        if (!_.isUndefined(callback)) {
            process.nextTick(function () {
                callback(null);
            });
        }
        return this;
    };
    Worker.prototype.postInit = function (dependencies, callback) {
        this.tellWorkflowStep('post-inited');
        this.postInited = true;
        if (!_.isUndefined(callback)) {
            process.nextTick(function () {
                callback(null);
            });
        }
        return this;
    };
    Worker.prototype.preStart = function (dependencies, callback) {
        this.tellWorkflowStep('pre-started');
        this.preStarted = true;
        if (!_.isUndefined(callback)) {
            process.nextTick(function () {
                callback(null);
            });
        }
        return this;
    };
    Worker.prototype.start = function (dependencies, callback) {
        this.tellWorkflowStep('ready');
        this.started = true;
        if (!_.isUndefined(callback)) {
            process.nextTick(function () {
                callback(null);
            });
        }
        return this;
    };
    Worker.prototype.postStart = function (dependencies, callback) {
        this.tellWorkflowStep('post-started');
        this.postStarted = true;
        if (!_.isUndefined(callback)) {
            process.nextTick(function () {
                callback(null);
            });
        }
        return this;
    };
    Worker.prototype.tellWorkflowStep = function (step) {
        this.annotate({
            log: {
                level: 900
            }
        }).tell(step);
    };
    Worker.prototype.getDependencyDefs = function () {
        return _.map(this.dependencies.list(), function (dep) {
            return {
                name: dep.me.name,
                optional: dep.optional
            };
        });
    };
    Worker.prototype.getCommEvent = function (event, method) {
        if (typeof event === 'string') {
            var split = event.split('.').reverse();
            var evt = {
                prefix: _.isUndefined(split[4]) ? this.comm.prefix() : split[4],
                service: _.isUndefined(split[3]) ? this.whoService.name : split[3],
                method: _.isUndefined(split[2]) ? method : split[2],
                worker: _.isUndefined(split[1]) ? this.me.name : split[1],
                name: split[0]
            };
            return new CommEvent(evt);
        }
        return new CommEvent(event);
    };
    Worker.prototype.getCommEmit = function (event, method) {
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
    Worker.prototype.tell = function (event, anno) {
        var evt = this.getCommEmit(event, 'tell');
        return this.comm.tell(evt, anno);
    };
    Worker.prototype.inform = function (event, info, anno) {
        var evt = this.getCommEmit(event, 'inform');
        return this.comm.inform(evt, info, anno);
    };
    Worker.prototype.confirm = function (event, callback, anno) {
        var evt = this.getCommEmit(event, 'confirm');
        return this.comm.confirm(evt, callback, anno);
    };
    Worker.prototype.check = function (event, toCheck, callback, anno) {
        var evt = this.getCommEmit(event, 'check');
        return this.comm.check(evt, toCheck, callback, anno);
    };
    Worker.prototype.ask = function (event, callback, anno) {
        var evt = this.getCommEmit(event, 'ask');
        return this.comm.ask(evt, callback, anno);
    };
    Worker.prototype.request = function (event, request, callback, anno) {
        var evt = this.getCommEmit(event, 'request');
        return this.comm.request(evt, request, callback, anno);
    };
    Worker.prototype.listen = function (event, listener) {
        var evt = this.getCommEvent(event, 'tell');
        this.checkOnce();
        this.comm.listen(evt, listener);
        return this;
    };
    Worker.prototype.info = function (event, listener) {
        var evt = this.getCommEvent(event, 'inform');
        this.checkOnce();
        this.comm.info(evt, listener);
        return this;
    };
    Worker.prototype.ack = function (event, listener) {
        var evt = this.getCommEvent(event, 'confirm');
        this.checkOnce();
        this.comm.ack(evt, listener);
        return this;
    };
    Worker.prototype.verify = function (event, listener) {
        var evt = this.getCommEvent(event, 'check');
        this.checkOnce();
        this.comm.verify(evt, listener);
        return this;
    };
    Worker.prototype.answer = function (event, listener) {
        var evt = this.getCommEvent(event, 'ask');
        this.checkOnce();
        this.comm.answer(evt, listener);
        return this;
    };
    Worker.prototype.respond = function (event, listener) {
        var evt = this.getCommEvent(event, 'request');
        this.checkOnce();
        this.comm.respond(evt, listener);
        return this;
    };
    Worker.prototype.checkOnce = function () {
        if (this.useOnce) {
            this.useOnce = false;
            this.comm.onlyOnce();
        }
    };
    Worker.prototype.annotate = function (anno) {
        this.comm.annotate(anno);
        return this;
    };
    Worker.prototype.onlyOnce = function () {
        this.useOnce = true;
        return this;
    };
    Worker.prototype.setMaxListeners = function (max) {
        this.comm.setMaxListeners(max);
        return this;
    };
    Worker.prototype.on = function (eventName, method) {
        var evt = this.getCommEvent(eventName);
        this.comm.on(evt.getText(), method);
        return this;
    };
    Worker.prototype.addListener = function (eventName, method) {
        var evt = this.getCommEvent(eventName);
        this.comm.addListener(evt.getText(), method);
        return this;
    };
    Worker.prototype.once = function (eventName, method) {
        var evt = this.getCommEvent(eventName);
        this.comm.once(evt.getText(), method);
        return this;
    };
    Worker.prototype.emit = function (eventName) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        var evt = this.getCommEvent(eventName);
        return this.comm.emit.apply(this.comm, [evt.getText()].concat(args));
    };
    Worker.prototype.removeListener = function (eventName, method) {
        var evt = this.getCommEvent(eventName);
        this.comm.removeListener(evt.getText(), method);
        return this;
    };
    Worker.prototype.removeAnnotatedListeners = function (eventName, anno) {
        var evt = this.getCommEvent(eventName);
        this.comm.removeAnnotatedListeners(evt.getText(), anno);
        return this;
    };
    Worker.prototype.removeAllListeners = function (eventName) {
        var _this = this;
        if (!_.isUndefined(eventName)) {
            this.comm.removeAllListeners(this.getCommEvent(eventName).getText());
        }
        else {
            _.each(this.comm.allCommListeners(), function (l) {
                if (l.commEvent.worker === _this.me.name) {
                    _this.comm.removeAllListeners(_this.getCommEvent(l.commEvent).getText());
                }
            });
        }
        return this;
    };
    Worker.prototype.removeAllAnnotatedListeners = function (anno, eventName) {
        var _this = this;
        if (!_.isUndefined(eventName)) {
            this.comm.removeAllAnnotatedListeners(anno, this.getCommEvent(eventName).getText());
        }
        else {
            _.each(this.comm.allCommListeners(), function (l) {
                if (l.commEvent.worker === _this.me.name) {
                    _this.comm.removeAllAnnotatedListeners(anno, _this.getCommEvent(l.commEvent).getText());
                }
            });
        }
        return this;
    };
    Worker.prototype.listeners = function (eventName) {
        var evt = this.getCommEvent(eventName);
        return _.pluck(this.comm.listeners(evt.getText()), 'method');
    };
    Worker.prototype.annotatedListeners = function (eventName, anno) {
        var evt = this.getCommEvent(eventName);
        return this.comm.annotatedListeners(evt.getText());
    };
    Worker.prototype.allListeners = function () {
        return this.comm.allListeners();
    };
    Worker.prototype.allCommListeners = function () {
        return this.comm.allCommListeners();
    };
    Worker.prototype.allAnnotatedListeners = function (anno, eventName) {
        if (!_.isUndefined(eventName)) {
            return this.comm.allAnnotatedListeners(anno, this.getCommEvent(eventName).getText());
        }
        return this.comm.allAnnotatedListeners(anno);
    };
    Worker.prototype.allInterceptors = function () {
        return this.comm.allInterceptors();
    };
    Worker.prototype.hasListener = function (event, method) {
        return this.comm.hasListener(this.getCommEvent(event, method));
    };
    Worker.prototype.intercept = function (eventName, interceptors) {
        var evt = this.getCommEvent(eventName);
        this.comm.intercept(evt.getText(), interceptors);
        return this;
    };
    Worker.prototype.dispose = function (callback) {
        if (!_.isUndefined(callback)) {
            process.nextTick(function () {
                callback();
            });
        }
    };
    return Worker;
}());
module.exports = Worker;
//# sourceMappingURL=Worker.js.map