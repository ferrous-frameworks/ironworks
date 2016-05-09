
import _ = require('lodash');

import IronBeam = require('iron-beam');
import IListener = IronBeam.IListener;

import idHelper = require('../helpers/idHelper');

import IAm = require('../interfaces/whoIAm/IAm');
import CommEvent = require('./CommEvent');
import ICommEvent = require('../interfaces/eventing/ICommEvent');
import ICommEventData = require('../interfaces/eventing/ICommEventData');
import ICommEmit = require('../interfaces/eventing/ICommEmit');
import ICommEmitData = require('../interfaces/eventing/ICommEmitData');
import CommEmit = require('../eventing/CommEmit');
import ICollection = require('../interfaces/collection/ICollection');
import ICommListener = require('../interfaces/eventing/ICommListener');

import Eventer = require('./Eventer');

import IComm = require('../interfaces/eventing/IComm');
import ICommOpts = require('../interfaces/opts/ICommOpts');

class Comm extends Eventer implements IComm {
    private whoService: IAm;
    private serviceWorkerName: string;
    
    public me: IAm;

    constructor(service: IAm, whoAmI: IAm, serviceWorkerName: string, opts?: ICommOpts) {
        super();

        this.whoService = service;
        this.serviceWorkerName = serviceWorkerName;

        var defOpts: ICommOpts = {
            prefix: 'comm'
        };
        this.opts = this.opts.beAdoptedBy<ICommOpts>(defOpts, 'eventer');
        this.opts.merge(opts);

        this.me = whoAmI;
    }

    public prefix(): string {
        return this.opts.get<string>('prefix');
    }

    public allCommListeners(): ICommListener[] {
        return _.map(this.allListeners(), (l: IListener): ICommListener => {
            return {
                event: l.event,
                annotation: l.annotation,
                method: l.method,
                onlyOnce: l.onlyOnce,
                commEvent: new CommEvent(l.event)
            }
        });
    }

    private getCommEvent(event: ICommEventData|string, method?: string): ICommEvent {
        if (typeof event === 'string') {
            var split = event.split('.').reverse();
            var evt: ICommEventData = {
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
        return <ICommEvent>event;
    }

    private getEmit(event: ICommEmitData|string, method?: string): ICommEmit {
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
        var emit = this.getEmit(event, 'tell');
        return super.tell(emit, anno);
    }

    public inform<infoType>(event: ICommEmitData|string, info: infoType, anno?: any): boolean {
        var emit = this.getEmit(event, 'inform');
        return super.inform<infoType>(emit, info, anno);
    }

    public confirm(event: ICommEmitData|string, callback: (e: Error, anno?: any) => void, anno?: any): boolean {
        var emit = this.getEmit(event, 'confirm');
        return super.confirm(emit, callback, anno);
    }

    public check<checkType>(event: ICommEmitData|string, toCheck: checkType, callback: (e: Error, anno?: any) => void, anno?: any): boolean {
        var emit = this.getEmit(event, 'check');
        return super.check(emit, toCheck, callback, anno);
    }

    public ask<answerType>(event: ICommEmitData|string, callback: (e: Error, answer?: answerType, anno?: any) => void, anno?: any): boolean {
        var emit = this.getEmit(event, 'ask');
        return super.ask<answerType>(emit, callback, anno);
    }

    public request<requestType, responseType>(
        event: ICommEmitData|string, request: requestType, callback: (e: Error, response?: responseType, anno?: any) => void, anno?: any)
    : boolean {
        var emit = this.getEmit(event, 'request');
        return super.request<requestType, responseType>(emit, request, callback, anno);
    }


    public listen(event: ICommEventData|string, listener: (anno?: any, emit?: ICommEmit) => void): IComm {
        var evt = this.getCommEvent(event, 'tell');
        super.listen(evt, listener);
        return this;
    }

    public info<infoType>(event: ICommEventData|string, listener: (info: infoType, anno?: any, emit?: ICommEmit) => void): IComm {
        var evt = this.getCommEvent(event, 'inform');
        super.info<infoType>(evt, listener);
        return this;
    }

    public ack(event: ICommEventData|string, listener: (callback: (e: Error) => void, anno?: any, emit?: ICommEmit) => void): IComm {
        var evt = this.getCommEvent(event, 'confirm');
        super.ack(evt, listener);
        return this;
    }

    public verify<checkType>(
        event: ICommEventData|string, listener: (toCheck: checkType, callback: (e: Error) => void, anno?: any, emit?: ICommEmit) => void)
    : IComm {
        var evt = this.getCommEvent(event, 'check');
        super.verify(evt, listener);
        return this;
    }

    public answer<answerType>(
        event: ICommEventData|string, listener: (callback: (e: Error, answer?: answerType) => void, anno?: any, emit?: ICommEmit) => void
    ): IComm {
        var evt = this.getCommEvent(event, 'ask');
        super.answer<answerType>(evt, listener);
        return this;
    }

    public respond<requestType, responseType>(
        event: ICommEventData|string,
        listener: (request: requestType, callback: (e: Error, response?: responseType) => void, anno?: any, emit?: ICommEmit) => void)
    : IComm {
        var evt = this.getCommEvent(event, 'request');
        super.respond<requestType, responseType>(evt, listener);
        return this;
    }

    public onlyOnce(): IComm {
        super.onlyOnce();
        return this;
    }


    public setMaxListeners(max: number): IComm {
        super.setMaxListeners(max);
        return this;
    }

    public annotate(anno: any): IComm {
        super.annotate(anno);
        return this;
    }

    public on(event: ICommEventData|string, method: Function): IComm {
        var evt = this.getCommEvent(event);
        super.on(evt.getText(), method);
        return this;
    }

    public addListener(event: ICommEventData|string, method: Function): IComm {
        var evt = this.getCommEvent(event);
        super.addListener(evt.getText(), method);
        return this;
    }

    public once(event: ICommEventData|string, method: Function): IComm {
        var evt = this.getCommEvent(event);
        super.once(evt.getText(), method);
        return this;
    }

    public emit(event: ICommEventData|string, ...args: any[]): boolean {
        var evt = this.getCommEvent(event);
        return super.emit.apply(this, [ evt.getText() ].concat(args));
    }

    public removeListener(event: ICommEventData|string, method: Function): IComm {
        var evt = this.getCommEvent(event);
        super.removeListener(evt.getText(), method);
        return this;
    }

    public removeAnnotatedListeners(event: string, anno?: any): IComm {
        var evt = this.getCommEvent(event);
        super.removeAnnotatedListeners(evt.getText(), anno);
        return this;
    }

    public removeAllListeners(event?: ICommEventData|string): IComm {
        if (!_.isUndefined(event)) {
            super.removeAllListeners(this.getCommEvent(event).getText());
        }
        else {
            _.each(this.allCommListeners(), (l: ICommListener) => {
                super.removeAllListeners(this.getCommEvent(l.commEvent).getText());
            });
        }
        return this;
    }

    public removeAllAnnotatedListeners(anno?: any, event?: ICommEventData|string): IComm {
        if (!_.isUndefined(event)) {
            super.removeAllAnnotatedListeners(anno, this.getCommEvent(event).getText());
        }
        else {
            _.each(this.allCommListeners(), (l: ICommListener) => {
                super.removeAllAnnotatedListeners(anno, this.getCommEvent(l.commEvent).getText());
            });
        }
        return this;
    }

    public listeners(event: ICommEventData|string): Function[] {
        var evt = this.getCommEvent(event);
        return (<any>_).pluck(super.listeners(evt.getText()), 'method');
    }

    public hasListener(event: ICommEventData|string, method?: string): boolean {
        var evt = this.getCommEvent(event, method);
        return super.hasListener(evt.getText());
    }

    public annotatedListeners(event: string, anno?: any): IListener[] {
        var evt = this.getCommEvent(event);
        return super.annotatedListeners(evt.getText(), anno);
    }

    public allAnnotatedListeners(anno?: any, event?: string): IListener[] {
        if (!_.isUndefined(event)) {
            return super.allAnnotatedListeners(anno, this.getCommEvent(event).getText());
        }
        return super.allAnnotatedListeners(anno);
    }

    public intercept(event: ICommEventData|string, interceptors: IronBeam.IInterceptors): IComm {
        var evt = this.getCommEvent(event);
        super.intercept(evt, interceptors);
        return this;
    }

    public dispose(callback?: () => void) {
        super.dispose(callback);
    }
}

export = Comm;
