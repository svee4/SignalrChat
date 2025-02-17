
export const timeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new TimeoutError(timeoutMs)), timeoutMs);
        promise.then(result => {
            clearTimeout(timeout);
            resolve(result);
        })
    });
}

export const assert = (condition: boolean, message: string) => {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

export const isNullish = <T>(v?: T): boolean => v === null || v === undefined;

export const assertNotNullish = <T>(v?: T, message?: string): NonNullable<T> => {
    assert(v !== null, message ?? "v !== null");
    assert(v !== undefined, message ?? "v !== undefined");
    return v!;
}

export class TimeoutError extends Error {
    constructor()
    constructor(message?: string)
    constructor(timeout?: number)
    constructor(message?: string, options?: ErrorOptions)
    constructor(timeout?: number, options?: ErrorOptions)
    constructor(input?: string | number, options?: ErrorOptions) {
        let message: string;

        switch (typeof(input)) {
            case "string": {
                message = input;
                break;
            }
            case "number": {
                message = `Timed out (${input}ms)`;
                break;
            }
            default: {
                message = "Timed out";
            }
        }

        super(message, options);
    }
}