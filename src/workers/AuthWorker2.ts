
import _ = require('lodash');
import async = require('async');

import ironTree = require('iron-tree');
import IronTree = ironTree.Tree;

import Worker = require('../workers/Worker');
import IWorker = require('../interfaces/workers/IWorker');

import idHelper = require('../helpers/idHelper');
import ICollection = require('../interfaces/collection/ICollection');
import IAmVersioned = require('../interfaces/whoIAm/IAmVersioned');
import ICommEvent = require('../interfaces/eventing/ICommEvent');
import ICommListener = require('../interfaces/eventing/ICommListener');

import IRole = require('../interfaces/auth/IRole');
import IRoleTreeElement = require('../interfaces/auth/IRoleTreeElement');
import ICredentials = require('../interfaces/auth/ICredentials');

import IHttpServerWorker = require('../interfaces/workers/IHttpServerWorker');
import ISocketWorker = require('../interfaces/workers/ISocketWorker');

interface IAuthenticationConfig {
    credsValidator?: string;
    authPackager?: string;
}

interface IWorkerAuthenticationConfig extends IAuthenticationConfig {
    worker: string;
}

import IWorkerChildOpts = require('../interfaces/opts/IWorkerChildOpts');
interface IAuthWorker2Opts extends IWorkerChildOpts {
    globalAuthenticationConfig?: IAuthenticationConfig;
    workerAuthenticationMap?: (IWorkerAuthenticationConfig|string)[]
}

class AuthWorker2 extends Worker implements IWorker {
    private workerAuthenticationMap: IWorkerAuthenticationConfig[];
    private roleTree: IronTree<IRole>;
    
    constructor(opts?: IAuthWorker2Opts) {
        super([], {
            id: idHelper.newId(),
            name: 'iw-auth2'
        }, opts);

        var defOpts: IAuthWorker2Opts = {
            globalAuthenticationConfig: {
                credsValidator: 'iw-creds-validator',
                authPackager: 'iw-auth-packager'
            },
            workerAuthenticationMap: [
                'iw-http-server',
                'iw-socket'
            ]
        };

        this.opts = this.opts.beAdoptedBy<IAuthWorker2Opts>(defOpts, 'worker');
        this.opts.merge(opts);
        
        this.roleTree = new IronTree<IRole>();
    }
    
    public init(cb): IWorker {
        this.annotate({ log: { properties: [ { name: 'password', secure: true } ] } })
        .respond<ICredentials, any>('authenticate', (creds, cb, anno, meta) => {
            this.authenticate(creds, meta.emitter.name, (e, packagedAuth) => {
                cb(e, packagedAuth);
            });
        });
        return super.init(cb);
    }
    
    private authenticate(creds: ICredentials, emitterName: string, cb: (e: Error, packagedAuth?: any) => void) {
        var emitterAuthenticationConfig = _.find(this.workerAuthenticationMap, (workerConfig) => {
            return workerConfig.worker === emitterName;
        });
        if (!_.isUndefined(emitterAuthenticationConfig)) {
            async.waterfall([
                (cb) => {
                    this.request(emitterAuthenticationConfig.credsValidator + '.validate-credentials', creds, (e, auth) => {
                        cb(e, auth);
                    });
                },
                (auth, errorCb) => {
                    this.request(emitterAuthenticationConfig.authPackager + '.package-auth', auth, (e, packagedAuth) => {
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
            ], (e) => {
                cb(e);
            });
        }
        else {
            cb(new Error('unable to find authentication config for ' + emitterName));
        }
    }
    
    public postInit(deps, cb): IWorker {
        this.workerAuthenticationMap = [];
        var globalConfig = this.opts.get<IAuthenticationConfig>('globalAuthenticationConfig');
        var workerAuthenticationMap = _.map(this.opts.get<(IWorkerAuthenticationConfig|string)[]>('workerAuthenticationMap'), (workerConfig) => {
            if (_.isString(workerConfig)) {
                workerConfig = {
                    worker: <string>workerConfig
                }
            }
            return workerConfig;
        });
        var workerAuthenticationMapGrouped = _.groupBy(workerAuthenticationMap, 'worker');
        _.each(workerAuthenticationMapGrouped, (workerAuthenticationMapGroups, worker) => {
            var mostSpecificConfig = (<any>_).max(workerAuthenticationMapGroups, (workerAuthenticationMapGroup) => {
                return _.keys(workerAuthenticationMapGroup).length;
            });
            mostSpecificConfig.credsValidator = _.isUndefined(mostSpecificConfig.credsValidator) ? globalConfig.credsValidator : mostSpecificConfig.credsValidator;
            mostSpecificConfig.authPackager = _.isUndefined(mostSpecificConfig.authPackager) ? globalConfig.authPackager : mostSpecificConfig.authPackager;
            this.workerAuthenticationMap.push(_.merge({
                worker: worker
            }, mostSpecificConfig));
        });
        var depsToAdd = _.uniq((<any>_).pluck(this.workerAuthenticationMap, 'worker')
            .concat((<any>_).pluck(this.workerAuthenticationMap, 'credsValidator'))
            .concat((<any>_).pluck(this.workerAuthenticationMap, 'authPackager')));
        _.each(depsToAdd, (depToAdd: string) => {
            this.addDependency(depToAdd, true);
        });
        return super.postInit(deps, cb);
    }
    
    public preStart(deps, cb): IWorker {
        return super.preStart(deps, (e) => {
            if (e === null) {
                var errors = [];
                _.each(this.workerAuthenticationMap, (workerConfig) => {
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
    }
    
    private static getDepWorker<T extends IWorker>(name: string, deps: ICollection<IWorker>): T {
        return <T>_.find(deps.list(), (worker) => {
            return worker.me.name === name;
        });
    }

    private setupRoleProvider(cb: (e: Error) => void) {
        var listener = void 0; //this.findListener('iw-role-provider', 'roleProviderWorkerName', 'request', 'role-tree');
        if (!_.isUndefined(listener)) {
            var emit = this.getCommEmit(listener.commEvent);
            this.request<IAmVersioned, IRoleTreeElement|string>(emit, this.whoService, (e, roleTreeElementOrString) => {
                var roleTreeElement: IRoleTreeElement;
                if (e === null) {
                    if (typeof roleTreeElementOrString === 'string') {
                        roleTreeElement = {
                            name: <string>roleTreeElementOrString
                        }
                    }
                    else {
                        roleTreeElement = <IRoleTreeElement>roleTreeElementOrString;
                    }
                    this.putRoleElementInTree(roleTreeElement);
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
    }
    private putRoleElementInTree(roleTreeElement: IRoleTreeElement, atKey?: string) {
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
            _.each(roleTreeElement.children, (child) => {
                this.putRoleElementInTree(child, atKey);
            });
        }
    }

}

export = AuthWorker2;
