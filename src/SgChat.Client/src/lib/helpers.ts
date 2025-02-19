import { ErrorCode as HubErrorCode, type HubError as HubErrorType } from "$lib/signalr/interop";

export const timeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new TimeoutError(timeoutMs)), timeoutMs);
        promise.then(result => {
            clearTimeout(timeout);
            resolve(result);
        })
    });
}

export class HubError extends Error {
    readonly code: HubErrorCode;
    readonly errorMessage: string | null;

    constructor(code: HubErrorCode, errorMessage: string | null, cause: unknown = undefined) {
        if (isNullish(errorMessage)) {
            super(code);
        } else {
            super(`${code} - ${errorMessage}`);
        }

        this.code = code;
        this.errorMessage = errorMessage;

        if (!isNullish(cause)) {
            this.cause = cause;
        }
    }
}

export const wrapHubError = async <T>(promise: Promise<T>): Promise<T> => {
    try {
        return await promise;
    } catch (err: any) {
        if (err instanceof Error) {
            const StartHubError = "STARTHUBERROR:"
            const EndHubError = ":ENDHUBERROR";

            const message = err.message;

            const start = message.indexOf(StartHubError);
            const end = message.indexOf(EndHubError);

            if (start > -1) {
                assert(end > -1, "end > -1");

                // we have a hub error!! woohooo!!
                // see server Interop.cs for notes on why we use this awful string parsing method
                const substring = message.substring(start + StartHubError.length, end);
                const json = JSON.parse(substring) as HubErrorType;

                assert(typeof json.code === "string", 'typeof json.code === "string"');
                assert(Object.values(HubErrorCode).includes(json.code), "Object.values(HubErrorCode).includes(json.code)");
                
                assert(json.errorMessage === null || typeof json.errorMessage === "string", 
                    'json.message === null || typeof json.message === "string"');

                throw new HubError(json.code, json.errorMessage);
            }
        }

        throw err;
    }
}

function getAllPropertyNames(obj: any) {
    var result: any[] = [];
    while (obj && obj !== Object.prototype) {
      result.push.apply(result, Object.getOwnPropertyNames(obj));
      obj = Object.getPrototypeOf(obj);
    }
    return result;
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