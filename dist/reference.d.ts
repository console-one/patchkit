export type ReferenceVersion = "live" | number;
export type ReferenceKind = "Artifact" | "Commit";
export interface ReferenceOptions {
    namespace: string;
    version?: string | number;
}
export interface ReferenceJSON {
    __type: "ref";
    value: string;
}
export declare class Reference {
    readonly namespace: string;
    readonly version: ReferenceVersion;
    readonly referenceType: ReferenceKind;
    constructor(options: string | Reference | ReferenceOptions);
    get __type(): "ref";
    get isLive(): boolean;
    get versionID(): string;
    toString(): string;
    toJSON(): ReferenceJSON;
    equals(other: Reference): boolean;
    private static parseString;
    static resolve(item: Reference | string | null | undefined): Reference | undefined;
    static fromString(str: string): Reference;
    static fromJSON(item: unknown): Reference | undefined;
    static validate(item: unknown): string[];
    static describes(item: unknown): boolean;
}
//# sourceMappingURL=reference.d.ts.map