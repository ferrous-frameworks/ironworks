
import IWorkerChildOpts = require('./IWorkerChildOpts');

import hapi = require('hapi');

interface IHttpServerWorkerOpts extends IWorkerChildOpts {
    host?
    port?: number;
    apiRoute?: string;
    rootSitePagePath?: string;
    hapi?: hapi.IServerOptions;
}

export = IHttpServerWorkerOpts;
