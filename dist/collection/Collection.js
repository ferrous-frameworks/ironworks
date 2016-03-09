var _ = require('lodash');
var async = require('async');
var Options = require('../opts/Options');
var idHelper = require('../helpers/idHelper');
var Collection = (function () {
    function Collection(id, opts) {
        this.me = {
            id: id,
            name: 'collection'
        };
        var defOpts = {};
        this.opts = new Options(defOpts);
        this.opts.merge(opts);
        this.collection = [];
    }
    Collection.prototype.add = function (item) {
        this.collection.push(item);
        return this;
    };
    Collection.prototype.addMany = function (items) {
        this.collection = this.collection.concat(items);
        return this;
    };
    Collection.prototype.remove = function (query, callback) {
        var removed = [];
        var instance = this;
        var collection = [];
        async.reduce(this.collection, collection, function (collection, item, callback) {
            var match = false;
            var idMatch = _.contains(query.ids, item.me.id)
                || _.isUndefined(query.ids)
                || query.ids.length === 0;
            var nameMatch = _.contains(query.names, item.me.name)
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
        }, function (e, collection) {
            instance.collection = collection;
            if (!_.isUndefined(callback)) {
                callback(e, new Collection(idHelper.newId()).addMany(removed));
            }
        });
    };
    Collection.prototype.get = function (query, callback) {
        var results = [];
        async.reduce(this.collection, results, function (results, item, cb) {
            var match = false;
            var idMatch = _.contains(query.ids, item.me.id)
                || _.isUndefined(query.ids)
                || query.ids.length === 0;
            var nameMatch = _.contains(query.names, item.me.name)
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
        }, function (e, results) {
            callback(e, new Collection(idHelper.newId()).addMany(results));
        });
    };
    Collection.prototype.list = function () {
        return this.collection;
    };
    Collection.prototype.clear = function () {
        this.collection = [];
        return this;
    };
    Collection.prototype.each = function (iterator, allDone) {
        async.each(this.collection, iterator, allDone);
    };
    Collection.prototype.filter = function (iterator, done) {
        var results = [];
        async.reduce(this.collection, results, function (results, item, cb) {
            iterator(item, function (e, check) {
                if (check) {
                    results.push(item);
                }
                cb(e, results);
            });
        }, function (e, results) {
            done(e, new Collection(idHelper.newId()).addMany(results));
        });
    };
    Collection.prototype.length = function () {
        return this.collection.length;
    };
    Collection.prototype.dispose = function (callback) {
        this.clear();
        if (!_.isUndefined(callback)) {
            callback();
        }
    };
    return Collection;
})();
module.exports = Collection;
//# sourceMappingURL=Collection.js.map