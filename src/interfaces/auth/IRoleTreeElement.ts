
import IRole = require('./IRole');

interface IRoleTreeElement extends IRole {
    children?: IRoleTreeElement[];
}

export = IRoleTreeElement;
