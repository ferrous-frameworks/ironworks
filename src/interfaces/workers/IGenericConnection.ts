
import IConnection = require('./IConnection');

interface IGenericConnection extends IConnection {
    type: string;
    data?: any;
}

export = IGenericConnection;
