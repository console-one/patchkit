export declare class CaptureGroup {
    readonly id: string;
    constructor(id?: string);
    toJSON(): string;
    toString(): string;
    static describesJSON(item: unknown): item is string;
    static fromJSON(item: unknown): CaptureGroup | undefined;
}
export declare class CaptureGroupSet {
    private readonly values;
    constructor();
    private keyOf;
    has(key: CaptureGroup | string): boolean;
    get(key: CaptureGroup | string): unknown;
    set(key: CaptureGroup | string, value: unknown): void;
    keys(): string[];
    size(): number;
}
//# sourceMappingURL=capture.d.ts.map