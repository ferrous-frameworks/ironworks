
import _ = require('lodash');

import IronBeam = require('iron-beam');
import IListener = IronBeam.IListener;
import IInterceptors = IronBeam.IInterceptors;

import idHelper = require('../helpers/idHelper');

import IComm = require('../interfaces/eventing/IComm');
import Options = require('../opts/Options');
import IAm = require('../interfaces/whoIAm/IAm');
import IAmVersioned = require('../interfaces/whoIAm/IAmVersioned');
import ICommEmit = require('../interfaces/eventing/ICommEmit');
import ICommEmitData = require('../interfaces/eventing/ICommEmitData');
import CommEmit = require('../eventing/CommEmit');
import ICommEvent = require('../interfaces/eventing/ICommEvent');
import ICommEventData = require('../interfaces/eventing/ICommEventData');
import CommEvent = require('../eventing/CommEvent');
import IDependency = require('../interfaces/workers/IDependency');
import ICollection = require('../interfaces/collection/ICollection');
import Collection = require('../collection/Collection');
import IWhoQuery = require('../interfaces/whoIAm/IWhoQuery');
import ICommListener = require('../interfaces/eventing/ICommListener');

import IWorker = require('../interfaces/workers/IWorker');
import IWorkerOpts = require('../interfaces/opts/IWorkerOpts');
import IWorkerChildOpts = require('../interfaces/opts/IWorkerChildOpts');

class Worker implements IWorker {
    protected dependencies: ICollection<IDependency<IWorker>>;
    protected useOnce: boolean;
    protected opts: Options<IWorkerChildOpts>;

    public whoService: IAmVersioned;
    public me: IAm;
    public comm: IComm;
    public inited: boolean;
    public postInited: boolean;
    public preStarted: boolean;
    public started: boolean;
    public postStarted: boolean;

    public defaultMaxListeners: number;

    constructor(dependencyNames: string[], whoAmI: IAm, opts: IWorkerChildOpts) {
        var defOpts: IWorkerOpts = {
            dependencies: []
        };
        this.opts = new Options<IWorkerChildOpts>(defOpts);
        this.opts.merge(_.isUndefined(opts) ? void 0 : opts.worker);

        var deps = this.opts.get<string[]>('dependencies');
        deps = deps.concat(dependencyNames);
        this.dependencies = new Collection<IDependency<IWorker>>(idHelper.newId());
        _.each(deps, (name) => {
            this.addDependency(name);
        });
        this.me = whoAmI;
        this.useOnce = false;
        this.inited = false;
        this.preStarted = false;
        this.started = false;
    }

    public addDependency(name: string) {
        this.dependencies.add({
            me: {
                id: idHelper.newId(),
                name: name
            }
        });
    }

    public preInit(comm: IComm, whoService: IAmVersioned, callback?: (e: Error) => void): IWorker {
        this.comm = comm;
        this.whoService = whoService;
        this.tellWorkflowStep('pre-inited');
        if (!_.isUndefined(callback)) {
            process.nextTick(() => {
                callback(null);
            });
        }
        return this;
    }

    public init(callback?: (e: Error) => void): IWorker {
        this.tellWorkflowStep('inited');
        this.inited = true;
        if (!_.isUndefined(callback)) {
            process.nextTick(() => {
                callback(null);
            });
        }
        return this;
    }

    public postInit(dependencies?: ICollection<IWorker>, callback?: (e: Error) => void): IWorker {
        this.tellWorkflowStep('post-inited');
        this.postInited = true;
        if (!_.isUndefined(callback)) {
            process.nextTick(() => {
                callback(null);
            });
        }
        return this;
    }

    public preStart(dependencies?: ICollection<IWorker>, callback?: (e: Error) => void): IWorker {
        this.tellWorkflowStep('pre-started');
        this.preStarted = true;
        if (!_.isUndefined(callback)) {
            process.nextTick(() => {
                callback(null);
            });
        }
        return this;
    }

    public start(dependencies?: ICollection<IWorker>, callback?: (e: Error) => void): IWorker {
        this.tellWorkflowStep('ready');
        this.started = true;
        if (!_.isUndefined(callback)) {
            process.nextTick(() => {
                callback(null);
            });
        }
        return this;
    }

    public postStart(dependencies?: ICollection<IWorker>, callback?: (e: Error) => void): IWorker {
        this.tellWorkflowStep('post-started');
        this.postStarted = true;
        if (!_.isUndefined(callback)) {
            process.nextTick(() => {
                callback(null);
            });
        }
        return this;
    }

    private tellWorkflowStep(step: string) {
        this.annotate({
            log: {
                level: 900
            }
        }).tell(step);
    }

    public getDependencyNames(): string[] {
        return (<any>_).pluck((<any>_).pluck(this.dependencies.list(), 'me'), 'name');
    }

    public getCommEvent(event: ICommEventData|string, method?: string): ICommEvent {
        if (typeof event === 'string') {
            var split = event.split('.').reverse();
            var evt: ICommEventData = {
                prefix: _.isUndefined(split[4]) ? this.comm.prefix() : split[4],
                service: _.isUndefined(split[3]) ? this.whoService.name : split[3],
                method: _.isUndefined(split[2]) ? method : split[2],
                worker: _.isUndefined(split[1]) ? this.me.name : split[1],
                name: split[0]
            };
            return new CommEvent(evt);
        }
        return new CommEvent(<ICommEventData>event);
    }

    public getCommEmit(event: ICommEventData|ICommEmitData|string, method?: string): ICommEmit {
        var evt = this.getCommEvent(event, method);
        var emit = <ICommEmit>event;
        return new CommEmit({
            id: _.isUndefined(emit.id) ? idHelper.newId() : emit.id,
            emitter: _.isUndefined(emit.emitter) ? this.me : emit.emitter,
            scoc: _.isUndefined(emit.scoc) ? [ this.whoService ] : emit.scoc,
            timestamp: _.isUndefined(emit.timestamp) ? new Date().getTime() : emit.timestamp,
            prefix: evt.prefix,
            service: evt.service,
            method: evt.method,
            worker: evt.worker,
            name: evt.name
        });
    }


    public tell(event: ICommEmitData|string, anno?: any): boolean {
        var evt = this.getCommEmit(event, 'tell');
        return this.comm.tell(evt, anno);
    }

    public inform<infoType>(event: ICommEmitData|string, info: infoType, anno?: any): boolean {
        var evt = this.getCommEmit(event, 'inform');
        return this.comm.inform<infoType>(evt, info, anno);
    }

    public confirm(event: ICommEmitData|string, callback: (e: Error, anno?: any) => void, anno?: any): boolean {
        var evt = this.getCommEmit(event, 'confirm');
        return this.comm.confirm(evt, callback, anno);
    }

    public check<checkType>(event: ICommEmitData|string, toCheck: checkType, callback: (e: Error, anno?: any) => void, anno?: any): boolean {
        var evt = this.getCommEmit(event, 'check');
        return this.comm.check(evt, toCheck, callback, anno);
    }

    public ask<answerType>(event: ICommEmitData|string, callback: (e: Error, answer?: answerType, anno?: any) => void, anno?: any): boolean {
        var evt = this.getCommEmit(event, 'ask');
        return this.comm.ask<answerType>(evt, callback, anno);
    }

    public request<requestType, responseType>(
        event: ICommEmitData|string, request: requestType, callback: (e: Error, response?: responseType, anno?: any) => void, anno?: any)
    : boolean {
        var evt = this.getCommEmit(event, 'request');
        return this.comm.request<requestType, responseType>(evt, request, callback, anno);
    }


    public listen(event: ICommEventData|string, listener: (anno?: any, emit?: ICommEmit) => void): IWorker {
        var evt = this.getCommEvent(event, 'tell');
        this.checkOnce();
        this.comm.listen(evt, listener);
        return this;
    }

    public info<infoType>(event: ICommEventData|string, listener: (info: infoType, anno?: any, emit?: ICommEmit) => void): IWorker {
        var evt = this.getCommEvent(event, 'inform');
        this.checkOnce();
        this.comm.info<infoType>(evt, listener);
        return this;
    }

    public ack(event: ICommEventData|string, listener: (callback: (e: Error) => void, anno?: any, emit?: ICommEmit) => void): IWorker {
        var evt = this.getCommEvent(event, 'confirm');
        this.checkOnce();
        this.comm.ack(evt, listener);
        return this;
    }

    public verify<checkType>(
        event: ICommEventData|string, listener: (toCheck: checkType, callback: (e: Error) => void, anno?: any, emit?: ICommEmit) => void)
    : IWorker {
        var evt = this.getCommEvent(event, 'check');
        this.checkOnce();
        this.comm.verify<checkType>(evt, listener);
        return this;
    }

    public answer<answerType>(
        event: ICommEventData|string, listener: (callback: (e: Error, answer?: answerType) => void, anno?: any, emit?: ICommEmit) => void
    ): IWorker {
        var evt = this.getCommEvent(event, 'ask');
        this.checkOnce();
        this.comm.answer<answerType>(evt, listener);
        return this;
    }

    public respond<requestType, responseType>(
        event: ICommEventData|string, listener: (request: requestType, callback: (e: Error, response?: responseType) => void, anno?: any, emit?: ICommEmit) => void
    ): IWorker {
        var evt = this.getCommEvent(event, 'request');
        this.checkOnce();
        this.comm.respond<requestType, responseType>(evt, listener);
        return this;
    }

    private checkOnce() {
        if (this.useOnce) {
            this.useOnce = false;
            this.comm.onlyOnce();
        }
    }

    public annotate(anno: any): IWorker {
        this.comm.annotate(anno);
        return this;
    }

    public onlyOnce(): IWorker {
        this.useOnce = true;
        return this;
    }


    public setMaxListeners(max: number): IWorker {
        this.comm.setMaxListeners(max);
        return this;
    }

    public on(eventName: ICommEventData|string, method: Function): IWorker {
        var evt = this.getCommEvent(eventName);
        this.comm.on(evt.getText(), method);
        return this;
    }

    public addListener(eventName: ICommEventData|string, method: Function): IWorker {
        var evt = this.getCommEvent(eventName);
        this.comm.addListener(evt.getText(), method);
        return this;
    }

    public once(eventName: ICommEventData|string, method: Function): IWorker {
        var evt = this.getCommEvent(eventName);
        this.comm.once(evt.getText(), method);
        return this;
    }

    public emit(eventName: ICommEventData|string, ...args: any[]): boolean {
        var evt = this.getCommEvent(eventName);
        return this.comm.emit.apply(this.comm, [ evt.getText() ].concat(args));
    }

    public removeListener(eventName: ICommEventData|string, method: Function): IWorker {
        var evt = this.getCommEvent(eventName);
        this.comm.removeListener(evt.getText(), method);
        return this;
    }

    public removeAnnotatedListeners(eventName: string, anno?: any): IWorker {
        var evt = this.getCommEvent(eventName);
        this.comm.removeAnnotatedListeners(evt.getText(), anno);
        return this;
    }

    public removeAllListeners(eventName?: ICommEventData|string): IWorker {
        if (!_.isUndefined(eventName)) {
            this.comm.removeAllListeners(this.getCommEvent(eventName).getText());
        }
        else {
            _.each(this.comm.allCommListeners(), (l: ICommListener) => {
                if (l.commEvent.worker === this.me.name) {
                    this.comm.removeAllListeners(this.getCommEvent(l.commEvent).getText());
                }
            });
        }
        return this;
    }

    public removeAllAnnotatedListeners(anno?: any, eventName?: string): IWorker {
        if (!_.isUndefined(eventName)) {
            this.comm.removeAllAnnotatedListeners(anno, this.getCommEvent(eventName).getText());
        }
        else {
            _.each(this.comm.allCommListeners(), (l: ICommListener) => {
                if (l.commEvent.worker === this.me.name) {
                    this.comm.removeAllAnnotatedListeners(anno, this.getCommEvent(l.commEvent).getText());
                }
            });
        }
        return this;
    }

    public listeners(eventName: ICommEventData|string): Function[] {
        var evt = this.getCommEvent(eventName);
        return (<any>_).pluck(this.comm.listeners(evt.getText()), 'method');
    }

    public annotatedListeners(eventName: string, anno?: any): IListener[] {
        var evt = this.getCommEvent(eventName);
        return this.comm.annotatedListeners(evt.getText());
    }

    public allListeners(): IListener[] {
        return this.comm.allListeners();
    }

    public allCommListeners(): ICommListener[] {
        return this.comm.allCommListeners();
    }

    public allAnnotatedListeners(anno?: any, eventName?: string): IListener[] {
        if (!_.isUndefined(eventName)) {
            return this.comm.allAnnotatedListeners(anno, this.getCommEvent(eventName).getText());
        }
        return this.comm.allAnnotatedListeners(anno);
    }

    public allInterceptors(): IInterceptors[] {
        return this.comm.allInterceptors();
    }

    public hasListener(event: ICommEventData|string, method?: string): boolean {
        return this.comm.hasListener(this.getCommEvent(event, method));
    }

    public intercept(eventName: ICommEventData|string, interceptors: IronBeam.IInterceptors): IWorker {
        var evt = this.getCommEvent(eventName);
        this.comm.intercept(evt.getText(), interceptors);
        return this;
    }


    public dispose(callback?: () => void) {
        if (!_.isUndefined(callback)) {
            process.nextTick(() => {
                callback();
            });
        }
    }
}

export = Worker;