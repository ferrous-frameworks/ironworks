
import IAm = require('./IAm');

interface IAmVersioned extends IAm {
    version: string;
}

export = IAmVersioned;
