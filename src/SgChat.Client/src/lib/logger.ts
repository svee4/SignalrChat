import { isNullish } from "./helpers";

export class Logger {

    readonly prefix?: string;

    constructor(prefix?: string) {
        this.prefix = prefix;
    }

    #format(logLevel: LogLevel, args: any[]) {
        if (isNullish(this.prefix)) {
            return args;
        }
        
        let color: string;
        switch (logLevel) {
            case LogLevel.Debug: color = "black"; break;
            case LogLevel.Info: color = "darkblue"; break;
            case LogLevel.Warn: color = "darkyellow"; break;
            case LogLevel.Error: color = "darkred"; break;
            default: throw new Error(`Unknown LogLevel ${logLevel}`);
        }

        return [`%c[${this.prefix}]`, `color: ${color}; background-color: #fff;`, ...args];
    }

    log(logLevel: LogLevel, ...args: any[]) {
        switch (logLevel) {
            case LogLevel.Debug: this.logDebug(...args); break;
            case LogLevel.Info: this.logInfo(...args); break;
            case LogLevel.Warn: this.logWarn(...args); break;
            case LogLevel.Error: this.logError(...args); break;
            default: throw new Error(`Unknown LogLevel ${logLevel}`);
        }
    }

    logDebug(...args: any[]) {
        console.debug(...this.#format(LogLevel.Debug, args));
    }

    logInfo(...args: any[]) {
        console.log(...this.#format(LogLevel.Info, args));
    }

    logWarn(...args: any[]) {
        console.warn(...this.#format(LogLevel.Warn, args));
    }

    logError(...args: any[]) {
        console.error(...this.#format(LogLevel.Error, args));
    }
}

export enum LogLevel {
    Debug = 1,
    Info,
    Warn,
    Error,
};

export default (prefix: string) => new Logger(prefix);