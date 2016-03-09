
import _ = require('lodash');
import async = require('async');

import Options = require('../opts/Options');
import IWhoQuery = require('../interfaces/whoIAm/IWhoQuery');
import idHelper = require('../helpers/idHelper');

import IWho = require('../interfaces/whoIAm/IWho');
import IAm = require('../interfaces/whoIAm/IAm');

import Eventer = require('../eventing/Eventer');

import ICollection = require('../interfaces/collection/ICollection');
import ICollectionOpts = require('../interfaces/opts/ICollectionOpts');

class Collection<whoType extends IWho> implements ICollection<whoType> {
    private opts: Options<ICollectionOpts>;
    private collection: whoType[];
    
    public me: IAm;

    constructor(id: string, opts?: ICollectionOpts) {
        this.me = {
            id: id,
            name: 'collection'
        };

        var defOpts: ICollectionOpts = {};
        this.opts = new Options<ICollectionOpts>(defOpts);
        this.opts.merge(opts);

        this.collection = [];
    }

    public add(item: whoType): ICollection<whoType> {
        this.collection.push(item);
        return this;
    }

    public addMany(items: whoType[]) {
        this.collection = this.collection.concat(items);
        return this;
    }

    public remove(query: IWhoQuery, callback?: (e: Error, removed: ICollection<whoType>) => void) {
        var removed: whoType[] = [];
        var instance: Collection<whoType> = this;
        var collection: whoType[] = [];
        async.reduce<whoType, whoType[]>(this.collection, collection, (collection, item, callback) => {
            var match = false;
            var idMatch =
                _.contains(query.ids, item.me.id)
                || _.isUndefined(query.ids)
                || query.ids.length === 0;
            var nameMatch =
                _.contains(query.names, item.me.name)
                || _.isUndefined(query.names)
                || query.names.length === 0;
            if (!_.isUndefined(query.op) && query.op === 'or') {
                match = idMatch || nameMatch;
            }
            else {
                match = idMatch && nameMatch;
            }
            if (match) {
                removed.push(item);
            }
            callback(null, collection);
        }, (e, collection) => {
            instance.collection = collection;
            if (!_.isUndefined(callback)) {
                callback(e, new Collection<whoType>(idHelper.newId()).addMany(removed));
            }
        });
    }

    public get(query: IWhoQuery, callback: (e: Error, result: ICollection<whoType>) => void) {
        var results: whoType[] = [];
        async.reduce<whoType, whoType[]>(this.collection, results, (results, item, cb) => {
            var match = false;
            var idMatch =
                _.contains(query.ids, item.me.id)
                || _.isUndefined(query.ids)
                || query.ids.length === 0;
            var nameMatch =
                _.contains(query.names, item.me.name)
                || _.isUndefined(query.names)
                || query.names.length === 0;
            if (!_.isUndefined(query.op) && query.op === 'or') {
                match = idMatch || nameMatch;
            }
            else {
                match = idMatch && nameMatch;
            }
            if (match) {
                results.push(item);
            }
            cb(null, results);
        }, (e, results) => {
            callback(e, new Collection<whoType>(idHelper.newId()).addMany(results));
        });
    }

    public list(): whoType[] {
        return this.collection;
    }

    public clear(): ICollection<whoType> {
        this.collection = [];
        return this;
    }

    public each(iterator: (item: whoType, itemDone: (e: Error) => void) => void, allDone?: (e: Error) => void) {
        async.each(this.collection, iterator, allDone);
    }

    public filter(
        iterator: (item: whoType, check: (e: Error, include: boolean) => void) => void,
        done: (e: Error, results: ICollection<whoType>) => void
    ) {
        var results: whoType[] = [];
        async.reduce<whoType, whoType[]>(this.collection, results, (results, item, cb) => {
            iterator(item, (e, check) => {
                if (check) {
                    results.push(item);
                }
                cb(e, results);
            });
        }, (e, results) => {
            done(e, new Collection<whoType>(idHelper.newId()).addMany(results));
        });
    }

    public length(): number {
        return this.collection.length;
    }

    public dispose(callback?: () => void) {
        this.clear();
        if (!_.isUndefined(callback)) {
            callback();
        }
    }
}

export = Collection;
