
import _ = require('lodash');

module.exports = function (chai, utils) {
    utils.addChainableMethod(chai.Assertion.prototype, 'method', function (methodName) {
        var obj = utils.flag(this, 'object');
        var check = !_.isUndefined(obj[methodName]) && typeof obj[methodName] === 'function';
        var failure = "";
        if (!check) {
            var name = !_.isUndefined(obj.name) ? obj.name : 'object';
            failure = "expected " + name + " to {{negation}}have a '" + methodName + "' method.";
        }
        this.assert(
            check,
            failure.replace("{{negation}}", ""),
            failure.replace("{{negation}}", "not "),
            methodName,
            obj[methodName]
        );
    });
};