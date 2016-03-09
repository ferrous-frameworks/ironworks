
declare module "uuid" {
    export function v1(
        options?: {
            node?: number[];
            clockseq?: number;
            msecs?: number|Date;
            nsecs?: number;
        },
        buffer?: Buffer|number[],
        offset?: number
    ): string;
    export function v4(
        options?: {
            random?: number[];
            rng?: any;
        },
        buffer?: Buffer|number[],
        offset?: number
    ): string;
    export function parse(
        id: string,
        buffer?: Buffer|number[],
        offset?: number
    ): Buffer;
    export function unparse(
        buffer?: Buffer|number[],
        offset?: number
    ): string;
}
