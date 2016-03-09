
import _ = require('lodash');
import async = require('async');

import IronBeam = require('iron-beam');
import EventEmitter = IronBeam.EventEmitter;
import IInterceptors = IronBeam.IInterceptors;

import idHelper = require('../helpers/idHelper');
import IEvent = require('../interfaces/eventing/IEvent');
import IEventData = require('../interfaces/eventing/IEventData');
import Event = require('./Event');
import IEmit = require('../interfaces/eventing/IEmit');
import IEmitData = require('../interfaces/eventing/IEmitData');
import IAm = require('../interfaces/whoIAm/IAm');
import Collection = require('../collection/Collection');
import ICollection = require('../interfaces/collection/ICollection');

import Options = require('../opts/Options');

import IEventer = require('../interfaces/eventing/IEventer');
import IEventerOpts = require('../interfaces/opts/IEventerOpts');

class Eventer extends EventEmitter implements IEventer {
    private useOnce: boolean;

    protected event: string;
    protected opts: Options<IEventerOpts>;

    constructor(opts?: IEventerOpts) {
        super();

        var defOpts: IEventerOpts = {};
        this.opts = new Options<IEventerOpts>(defOpts);
        this.opts.merge(opts);

        this.useOnce = false;

        this.event = "";
    }

    public getLastEvent(): string {
        return this.event;
    }


    public static getListenMethodName(emitMethodName: string): string {
        switch (emitMethodName) {
            case 'tell'     : return 'listen';
            case 'inform'   : return 'info';
            case 'confirm'  : return 'ack';
            case 'check'    : return 'verify';
            case 'ask'      : return 'answer';
            case 'request'  : return 'respond';
        }
    }


    private static getEvent(event: IEventData|string): IEvent {
        if (typeof event === 'string') {
            return new Event({
                name: event
            });
        }
        else if (!(event instanceof Event)) {
            return new Event(event);
        }
        return <IEvent>event;
    }
    

    public tell(event: IEmitData|string, anno?: any): boolean {
        var evt = Eventer.getEvent(event);
        if (!_.isUndefined(anno)) {
            super.annotate(anno);
        }
        return super.emit(evt.getText(), evt);
    }

    public inform<infoType>(event: IEmitData|string, info: infoType, anno?: any): boolean {
        var evt = Eventer.getEvent(event);
        if (!_.isUndefined(anno)) {
            super.annotate(anno);
        }
        return super.emit(evt.getText(), evt, info);
    }

    public confirm(event: IEmitData|string, callback: (e: Error, anno?: any) => void, anno?: any): boolean {
        var evt = Eventer.getEvent(event);
        if (!_.isUndefined(anno)) {
            super.annotate(anno);
        }
        return super.emit(evt.getText(), evt, callback);
    }

    public check<checkType>(event: IEmitData|string, toCheck: checkType, callback: (e: Error, anno?: any) => void, anno?: any): boolean {
        var evt = Eventer.getEvent(event);
        if (!_.isUndefined(anno)) {
            super.annotate(anno);
        }
        return super.emit(evt.getText(), evt, toCheck, callback);
    }

    public ask<answerType>(event: IEmitData|string, callback: (e: Error, answer?: answerType, anno?: any) => void, anno?: any): boolean {
        var evt = Eventer.getEvent(event);
        if (!_.isUndefined(anno)) {
            super.annotate(anno);
        }
        return super.emit(evt.getText(), evt, callback);
    }

    public request<requestType, responseType>(
        event: IEmitData|string, request: requestType, callback: (e: Error, response?: responseType, anno?: any) => void, anno?: any)
    : boolean {
        var evt = Eventer.getEvent(event);
        if (!_.isUndefined(anno)) {
            super.annotate(anno);
        }
        return super.emit(evt.getText(), evt, request, callback);
    }


    public listen(event: IEventData|string, listener: (anno?: any, emit?: IEmit) => void): IEventer {
        return this.setupListener(event, listener);
    }

    public info<infoType>(event: IEventData|string, listener: (info: infoType, anno?: any, emit?: IEmit) => void): IEventer {
        return this.setupListener(event, listener);
    }

    public ack(event: IEventData|string, listener: (callback: (e: Error) => void, anno?: any, emit?: IEmit) => void): IEventer {
        return this.setupListener(event, listener);
    }

    public verify<checkType>(
        event: IEventData|string, listener: (toCheck: checkType, callback: (e: Error) => void, anno?: any, emit?: IEmit) => void)
    : IEventer {
        return this.setupListener(event, listener);
    }

    public answer<answerType>(
        event: IEventData|string, listener: (callback: (e: Error, answer?: answerType) => void, anno?: any, emit?: IEmit) => void)
    : IEventer {
        return this.setupListener(event, listener);
    }

    public respond<requestType, responseType>(
        event: IEventData|string,
        listener: (request: requestType, callback: (e: Error, response?: responseType) => void, anno?: any, emit?: IEmit) => void)
    : IEventer {
        return this.setupListener(event, listener);
    }

    public onlyOnce(): IEventer {
        this.useOnce = true;
        return this;
    }

    private setupListener(event: IEventData|string, listener: Function) {
        var evt = Eventer.getEvent(event);
        if (this.useOnce) {
            this.useOnce = false;
            super.once(evt.getText(), (emit: IEmit, ...args: any[]) => {
                this.callListener(listener, emit, args);
            });
        }
        else {
            super.on(evt.getText(), (emit: IEmit, ...args: any[]) => {
                this.callListener(listener, emit, args);
            });
        }
        return this;
    }

    private callListener(listener, emit, args) {
        listener.apply(listener, args.concat(emit));
    }


    public setMaxListeners(max: number): IEventer {
        super.setMaxListeners(max);
        return this;
    }
    public annotate(anno: any): IEventer {
        super.annotate(anno);
        return this;
    }
    public on(event: IEventData|string, method: Function): IEventer {
        var evt = Eventer.getEvent(event);
        super.on(evt.getText(), method);
        return this;
    }
    public addListener(event: IEventData|string, method: Function): IEventer {
        var evt = Eventer.getEvent(event);
        super.addListener(evt.getText(), method);
        return this;
    }
    public once(event: IEventData|string, method: Function): IEventer {
        var evt = Eventer.getEvent(event);
        super.once(evt.getText(), method);
        return this;
    }
    public removeListener(event: IEventData|string, method: Function): IEventer {
        var evt = Eventer.getEvent(event);
        super.removeListener(evt.getText(), method);
        return this;
    }
    public removeAnnotatedListeners(event: IEventData|string, anno?: any): IEventer {
        var evt = Eventer.getEvent(event);
        super.removeAnnotatedListeners(evt.getText(), anno);
        return this;
    }
    public removeAllListeners(event?: IEventData|string): IEventer {
        if (_.isUndefined(event)) {
            super.removeAllListeners();
        }
        else {
            var evt = Eventer.getEvent(event);
            super.removeAllListeners(evt.getText());
        }
        return this;
    }
    public removeAllAnnotatedListeners(anno?: any, event?: IEventData|string): IEventer {
        if (_.isUndefined(event)) {
            super.removeAllAnnotatedListeners(anno);
        }
        else {
            var evt = Eventer.getEvent(event);
            super.removeAllAnnotatedListeners(anno, evt.getText());
        }
        return this;
    }

    public intercept(event: IEventData|string, interceptors: IInterceptors): IEventer {
        var evt = Eventer.getEvent(event);
        super.intercept(evt.getText(), interceptors);
        return this;
    }

    public dispose(callback?: () => void) {
        super.dispose(callback);
    }
}

export = Eventer;
