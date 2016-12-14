
import IAm = require('./IAm');

interface IAmVersioned extends IAm {
    version: string;
    nodeVersion?: string;
}

export = IAmVersioned;
