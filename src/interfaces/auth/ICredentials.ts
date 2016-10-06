
import IUser = require('./IUser');

interface ICredentials extends IUser {
    password?: string;
}

export = ICredentials;
