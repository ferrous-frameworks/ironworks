"use strict";
var _ = require('lodash');
module.exports = function (chai, utils) {
    utils.addChainableMethod(chai.Assertion.prototype, 'listener', function (event, count) {
        var obj = utils.flag(this, 'object');
        if (_.isUndefined(count) || count < 1) {
            count = 1;
        }
        var listenerCount = obj.listeners(event).length;
        var check = listenerCount === count;
        var failure = "";
        if (!check) {
            var name = !_.isUndefined(obj.name) ? obj.name : 'object';
            failure = "expected " + name + " to {{negation}}have ";
            if (count > 1) {
                failure += count + " listeners";
            }
            else {
                failure += "a listener";
            }
            failure += " to the '" + event + "' event, but found " + listenerCount + " listeners.";
        }
        this.assert(check, failure.replace("{{negation}}", ""), failure.replace("{{negation}}", "not "), count, listenerCount);
    });
};
//# sourceMappingURL=toHaveAListener.js.map