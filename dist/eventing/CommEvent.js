"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var _ = require('lodash');
var Event = require('./Event');
var CommEvent = (function (_super) {
    __extends(CommEvent, _super);
    function CommEvent(event) {
        var evt;
        if (typeof event === 'string') {
            evt = {
                prefix: void 0,
                service: void 0,
                method: void 0,
                worker: void 0,
                name: event
            };
        }
        else {
            evt = event;
        }
        var split = evt.name.split('.').reverse();
        evt.prefix = _.isUndefined(split[4]) ? evt.prefix : split[4];
        evt.service = _.isUndefined(split[3]) ? evt.service : split[3];
        evt.method = _.isUndefined(split[2]) ? evt.method : split[2];
        evt.worker = _.isUndefined(split[1]) ? evt.worker : split[1];
        evt.name = _.isUndefined(split[0]) ? evt.name : split[0];
        _super.call(this, evt);
        this.prefix = evt.prefix;
        this.service = evt.service;
        this.method = evt.method;
        this.worker = evt.worker;
    }
    CommEvent.prototype.getText = function () {
        return _.compact([
            this.prefix,
            this.service,
            this.method,
            this.worker,
            this.name
        ]).join('.');
    };
    CommEvent.prototype.equal = function (event) {
        return CommEvent.equal(this, event);
    };
    CommEvent.equal = function (evt1, evt2) {
        var prefixMatch = evt1.prefix === '*' || evt2.prefix === '*' || evt1.prefix === evt2.prefix;
        var serviceMatch = evt1.service === '*' || evt2.service === '*' || evt1.service === evt2.service;
        var methodMatch = evt1.method === '*' || evt2.method === '*' || evt1.method === evt2.method;
        var workerMatch = evt1.worker === '*' || evt2.worker === '*' || evt1.worker === evt2.worker;
        var nameMatch = evt1.name === '*' || evt2.name === '*' || evt1.name === evt2.name;
        return prefixMatch && serviceMatch && methodMatch && workerMatch && nameMatch;
    };
    return CommEvent;
}(Event));
module.exports = CommEvent;
//# sourceMappingURL=CommEvent.js.map