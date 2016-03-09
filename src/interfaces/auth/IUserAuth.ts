
import IUser = require('./IUser');
import IAmVersioned = require('../whoIAm/IAmVersioned');
import IRole = require('./IRole');

interface IUserAuth extends IUser {
    issuer: IAmVersioned;
    authentication?: {
        interservice: boolean;
    };
    authorization?: {
        user: {
            roles: IRole[];
        }
    };
}

export = IUserAuth;
