"use strict";
var _ = require('lodash');
var Options = (function () {
    function Options(defaults) {
        this.defaults = {};
        this.options = {};
        var instance = this;
        _.each(defaults, function (v, k) {
            instance.defaults[k] = _.cloneDeep(v);
            instance.options[k] = _.cloneDeep(v);
        });
    }
    Options.prototype.get = function (dotDelimitedKey) {
        return _.get(this.options, dotDelimitedKey);
    };
    Options.prototype.has = function (dotDelimitedKey) {
        return !_.isUndefined(this.get(dotDelimitedKey));
    };
    Options.prototype.beAdoptedBy = function (parentDefs, childName) {
        var childDefs = {};
        childDefs[childName] = this.defaults;
        var defs = _.extend(parentDefs, childDefs);
        var parent = new Options(defs);
        Options.recursiveMerge(this.options, parent.get(childName), defs[childName]);
        return parent;
    };
    Options.prototype.merge = function (newOpts) {
        Options.recursiveMerge(newOpts, this.options, this.defaults);
    };
    Options.recursiveMerge = function (newOpts, currentOpts, currentDefs) {
        _.each(newOpts, function (v, k) {
            if (typeof v === 'object') {
                var isArr = _.isArray(v);
                if (_.isUndefined(currentOpts[k])) {
                    currentOpts[k] = isArr ? [] : {};
                }
                if (_.isUndefined(currentDefs[k])) {
                    currentDefs[k] = isArr ? [] : {};
                }
                if (_.isArray(v) && _.isArray(currentOpts[k]) && _.isArray(currentDefs[k])) {
                    currentOpts[k] = _.uniq(currentOpts[k].concat(v));
                }
                else {
                    Options.recursiveMerge(v, currentOpts[k], currentDefs[k]);
                }
            }
            else {
                if (_.isUndefined(currentDefs[k])) {
                    currentDefs[k] = v;
                }
                currentOpts[k] = v;
            }
        });
    };
    return Options;
}());
module.exports = Options;
//# sourceMappingURL=Options.js.map