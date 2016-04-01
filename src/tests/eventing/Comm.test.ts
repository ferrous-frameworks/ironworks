
/// <reference path="../../typings/master.d.ts" />

import chai = require('chai');
var expect = chai.expect;
var assert = chai.assert;

chai.use(require('../_chai/toHaveAListener'));
chai.use(require('../_chai/toHaveAMethod'));

import Comm = require('../../eventing/Comm');

describe('Comm', function () {
    var prefix = 'comm-prefix';
    var comm;
    beforeEach(function (done) {
        comm = new Comm({
            id: 'service-id',
            name: 'service-name'
        }, {
            id: 'comm-id',
            name: 'comm-name'
        }, "iw-service", {
            prefix: prefix
        });
        done();
    });

    it("should have a 'prefix' method that returns the 'prefix' option value", function () {
        expect(comm.prefix()).to.be.equal(prefix);
    });

    it("should have a 'hasListener' method that runs true if a specific or wildcard listener is found", function () {
        comm.listen('comm.*.*.*.*', function () {});
        var hasListener = comm.hasListener('comm.test1.test2.test3.test4');
        expect(hasListener).to.be.true;
    });
});
