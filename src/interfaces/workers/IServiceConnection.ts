
import IConnection = require('./IConnection');
import IHttpEndPoint = require('./IHttpEndPoint');

interface IServiceConnection extends IConnection {
    protocol?: string; //TODO: i made is optional. Changing it will break tests
    url?: string;
    endPoints?: IHttpEndPoint[];
    token?: string;
    data?: any;
    type?:string;
}

export = IServiceConnection;
