import IWorkerChildOpts = require('./IWorkerChildOpts');
import HttpAutoAuthenticationType = require('../../enums/auth/HttpAutoAuthenticationType');
import ICommEventData = require('../../interfaces/eventing/ICommEventData');

interface IAuthWorkerOpts extends IWorkerChildOpts {
    socket?: {
        authentication?: {
            timeout?: number;
            secure?: boolean;
            interserviceTokenEnvVarName?: string;
        }
    };
    http?: {
        authentication?: {
            auto?: HttpAutoAuthenticationType;
            listenersToAuthenticate?: (ICommEventData|string)[];
            listenersToNotAuthenticate?: (ICommEventData|string)[];
            workersToAuthenticate?: (ICommEventData|string)[];
            workersToNotAuthenticate?: (ICommEventData|string)[];
        }
        clientSecretEnvVarName?: string;
        accessTokenExpiration?: number;
        refreshTokenExpiration?: number;
    };
}

export = IAuthWorkerOpts;
