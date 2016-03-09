/// <reference path="../../typings/tsd/tsd.d.ts" />
var chai = require('chai');
var expect = chai.expect;
var assert = chai.assert;
chai.use(require('../_chai/toHaveAMethod'));
var Collection = require('../../collection/Collection');
describe('Collection', function () {
    var collection;
    var id = 'collection-id';
    var test = {
        id: id,
        me: {
            id: id,
            name: 'collection-name'
        },
        some: "data"
    };
    beforeEach(function (done) {
        collection = new Collection('TestCollection');
        done();
    });
    it("should implement an 'add' method that adds an item to the collection", function () {
        collection.add({
            id: 'test'
        });
        expect(collection.collection.length).to.be.equal(1);
    });
    it("should implement a 'remove' method that removes an item from the collection and passes it to the callback", function (done) {
        collection.add(test);
        collection.remove({ ids: [id] }, function (e, removed) {
            expect(collection.collection.length).to.be.equal(0);
            assert(Array.isArray(removed.list()), 'remove.list() is not an array');
            expect(removed.length()).to.be.equal(1);
            expect(removed.list()[0]).to.be.equal(test);
            done();
        });
    });
    it("should implement a 'get' method that looks for items matching any id in the 'ids' param and passes the matches to the callback", function (done) {
        collection.add(test);
        collection.get({ ids: [id] }, function (e, results) {
            expect(results.length()).to.be.equal(1);
            expect(results.list()[0]).to.be.equal(test);
            done();
        });
    });
    it("should implement a 'filter' method that calls a 'done' callback when all the items have been passed through the iterator truth check", function (done) {
        collection.add(test);
        var anotherTest = {
            id: 'another-test-id',
            some: "data2"
        };
        collection.add(anotherTest);
        collection.filter(function (item, check) {
            check(null, item.some === anotherTest.some);
        }, function (e, results) {
            expect(results.length()).to.be.equal(1);
            expect(results.list()[0]).to.be.equal(anotherTest);
            done();
        });
    });
    it("should have a 'dispose' method", function () {
        assert.isFunction(collection.dispose);
        //expect(collection).to.have.a.method('dispose');
    });
});
//# sourceMappingURL=Collection.test.js.map