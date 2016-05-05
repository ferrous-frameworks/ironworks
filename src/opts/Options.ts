
import fs = require('fs');

import _ = require('lodash');

class Options<I> {
    private defaults: any;
    private options: any|I;

    constructor(defaults: I) {
        this.defaults = {};
        this.options = {};
        var instance = this;
        _.each(defaults, (v, k) => {
            instance.defaults[k] = _.cloneDeep(v);
            instance.options[k] = _.cloneDeep(v);
        });
    }

    public get<getI>(dotDelimitedKey: string): getI {
        return <getI>(<any>_).get(this.options, dotDelimitedKey);
    }

    public has(dotDelimitedKey: string): boolean {
        return !_.isUndefined(this.get<any>(dotDelimitedKey));
    }

    public beAdoptedBy<parentI>(parentDefs: I, childName: string): Options<I> {
        var childDefs = {};
        childDefs[childName] = this.defaults;
        var defs = _.extend(parentDefs, childDefs);
        var parent = new Options<any>(defs);
        Options.recursiveMerge(this.options, parent.get<any>(childName), defs[childName]);
        return parent;
    }

    public merge(newOpts: I) {
        Options.recursiveMerge(newOpts, this.options, this.defaults);
    }

    private static recursiveMerge(newOpts: any, currentOpts: any, currentDefs: any): void {
        _.each(newOpts, (v, k) => {
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
    }
}

export = Options;
