export class Logger {

    readonly prefix?: string;

    constructor(prefix?: string) {
        this.prefix = prefix;
    }

    #format(args: any[]) {
        return this.prefix ? [`[${this.prefix}]`, ...args] : args;
    }

    logDebug(...args: any[]) {
        console.debug(...this.#format(args));
    }

    logInfo(...args: any[]) {
        console.log(...this.#format(args));
    }

    logError(...args: any[]) {
        console.error(...this.#format(args));
    }
}

export default (prefix: string) => new Logger(prefix);