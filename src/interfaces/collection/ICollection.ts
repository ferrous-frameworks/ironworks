
import IWhoQuery = require('../whoIAm/IWhoQuery');

import IWho = require('../whoIAm/IWho');

interface ICollection<whoType extends IWho> extends IWho {
    add(item: whoType): ICollection<whoType>;
    addMany(items: whoType[]): ICollection<whoType>;
    remove(query: IWhoQuery, callback?: (e: Error, result: ICollection<whoType>) => void);
    get(query: IWhoQuery, callback: (e: Error, result: ICollection<whoType>) => void);
    clear(): ICollection<whoType>;
    list(): whoType[];
    each(iterator: (item: whoType, itemDone: (e: Error) => void) => void, allDone?: (e: Error) => void);
    filter(
        iterator: (item: whoType, check: (e: Error, include: boolean) => void) => void,
        done: (e: Error, results: ICollection<whoType>) => void
    );
    length(): number;
    dispose(callback?: () => void);
}

export = ICollection;
