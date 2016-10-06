"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var _ = require('lodash');
var async = require('async');
var ironTree = require('iron-tree');
var IronTree = ironTree.Tree;
var Worker = require('../workers/Worker');
var idHelper = require('../helpers/idHelper');
var AuthWorker2 = (function (_super) {
    __extends(AuthWorker2, _super);
    function AuthWorker2(opts) {
        _super.call(this, [], {
            id: idHelper.newId(),
            name: 'iw-auth2'
        }, opts);
        var defOpts = {
            globalAuthenticationConfig: {
                credsValidator: 'iw-creds-validator',
                authPackager: 'iw-auth-packager'
            },
            workerAuthenticationMap: [
                'iw-http-server',
                'iw-socket'
            ]
        };
        this.opts = this.opts.beAdoptedBy(defOpts, 'worker');
        this.opts.merge(opts);
        this.roleTree = new IronTree();
    }
    AuthWorker2.prototype.init = function (cb) {
        var _this = this;
        this.annotate({ log: { properties: [{ name: 'password', secure: true }] } })
            .respond('authenticate', function (creds, cb, anno, meta) {
            _this.authenticate(creds, meta.emitter.name, function (e, packagedAuth) {
                cb(e, packagedAuth);
            });
        });
        return _super.prototype.init.call(this, cb);
    };
    AuthWorker2.prototype.authenticate = function (creds, emitterName, cb) {
        var _this = this;
        var emitterAuthenticationConfig = _.find(this.workerAuthenticationMap, function (workerConfig) {
            return workerConfig.worker === emitterName;
        });
        if (!_.isUndefined(emitterAuthenticationConfig)) {
            async.waterfall([
                function (cb) {
                    _this.request(emitterAuthenticationConfig.credsValidator + '.validate-credentials', creds, function (e, auth) {
                        cb(e, auth);
                    });
                },
                function (auth, errorCb) {
                    _this.request(emitterAuthenticationConfig.authPackager + '.package-auth', auth, function (e, packagedAuth) {
                        if (e !== null) {
                            errorCb(e);
                        }
                        else {
                            cb(null, {
                                auth: auth,
                                packagedAuth: packagedAuth
                            });
                        }
                    });
                }
            ], function (e) {
                cb(e);
            });
        }
        else {
            cb(new Error('unable to find authentication config for ' + emitterName));
        }
    };
    AuthWorker2.prototype.postInit = function (deps, cb) {
        var _this = this;
        this.workerAuthenticationMap = [];
        var globalConfig = this.opts.get('globalAuthenticationConfig');
        var workerAuthenticationMap = _.map(this.opts.get('workerAuthenticationMap'), function (workerConfig) {
            if (_.isString(workerConfig)) {
                workerConfig = {
                    worker: workerConfig
                };
            }
            return workerConfig;
        });
        var workerAuthenticationMapGrouped = _.groupBy(workerAuthenticationMap, 'worker');
        _.each(workerAuthenticationMapGrouped, function (workerAuthenticationMapGroups, worker) {
            var mostSpecificConfig = _.max(workerAuthenticationMapGroups, function (workerAuthenticationMapGroup) {
                return _.keys(workerAuthenticationMapGroup).length;
            });
            mostSpecificConfig.credsValidator = _.isUndefined(mostSpecificConfig.credsValidator) ? globalConfig.credsValidator : mostSpecificConfig.credsValidator;
            mostSpecificConfig.authPackager = _.isUndefined(mostSpecificConfig.authPackager) ? globalConfig.authPackager : mostSpecificConfig.authPackager;
            _this.workerAuthenticationMap.push(_.merge({
                worker: worker
            }, mostSpecificConfig));
        });
        var depsToAdd = _.uniq(_.pluck(this.workerAuthenticationMap, 'worker')
            .concat(_.pluck(this.workerAuthenticationMap, 'credsValidator'))
            .concat(_.pluck(this.workerAuthenticationMap, 'authPackager')));
        _.each(depsToAdd, function (depToAdd) {
            _this.addDependency(depToAdd, true);
        });
        return _super.prototype.postInit.call(this, deps, cb);
    };
    AuthWorker2.prototype.preStart = function (deps, cb) {
        var _this = this;
        return _super.prototype.preStart.call(this, deps, function (e) {
            if (e === null) {
                var errors = [];
                _.each(_this.workerAuthenticationMap, function (workerConfig) {
                    var workerDep = AuthWorker2.getDepWorker(workerConfig.worker, deps);
                    if (!_.isUndefined(workerDep)) {
                        var credsValidator = AuthWorker2.getDepWorker(workerConfig.credsValidator, deps);
                        var authPackager = AuthWorker2.getDepWorker(workerConfig.authPackager, deps);
                        if (_.isUndefined(credsValidator)) {
                            errors.push(workerConfig.credsValidator + ' is required by ' + workerConfig.worker + ' to validate credentials');
                        }
                        if (_.isUndefined(authPackager)) {
                            errors.push(workerConfig.authPackager + ' is required by ' + workerConfig.worker + ' to package authorization objects');
                        }
                    }
                });
                if (!_.isEmpty(errors)) {
                    cb(new Error(errors.join(' & ')));
                }
                else {
                    cb(null);
                }
            }
            else {
                cb(e);
            }
        });
    };
    AuthWorker2.getDepWorker = function (name, deps) {
        return _.find(deps.list(), function (worker) {
            return worker.me.name === name;
        });
    };
    AuthWorker2.prototype.setupRoleProvider = function (cb) {
        var _this = this;
        var listener = void 0; //this.findListener('iw-role-provider', 'roleProviderWorkerName', 'request', 'role-tree');
        if (!_.isUndefined(listener)) {
            var emit = this.getCommEmit(listener.commEvent);
            this.request(emit, this.whoService, function (e, roleTreeElementOrString) {
                var roleTreeElement;
                if (e === null) {
                    if (typeof roleTreeElementOrString === 'string') {
                        roleTreeElement = {
                            name: roleTreeElementOrString
                        };
                    }
                    else {
                        roleTreeElement = roleTreeElementOrString;
                    }
                    _this.putRoleElementInTree(roleTreeElement);
                    cb(null);
                }
                else {
                    cb(e);
                }
            });
        }
        else {
            cb(new Error(this.me.name + ' requires a iw-role-provider to request a role-tree'));
        }
    };
    AuthWorker2.prototype.putRoleElementInTree = function (roleTreeElement, atKey) {
        var _this = this;
        if (!_.isUndefined(atKey)) {
            atKey += '.';
        }
        else {
            atKey = '';
        }
        atKey += roleTreeElement.name;
        var role = _.cloneDeep(roleTreeElement);
        delete role.children;
        this.roleTree.add(atKey, role);
        if (!_.isEmpty(roleTreeElement.children)) {
            _.each(roleTreeElement.children, function (child) {
                _this.putRoleElementInTree(child, atKey);
            });
        }
    };
    return AuthWorker2;
}(Worker));
module.exports = AuthWorker2;
//# sourceMappingURL=AuthWorker2.js.map