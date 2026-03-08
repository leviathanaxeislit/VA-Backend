"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLogger = void 0;
const pino_1 = __importDefault(require("pino"));
/**
 * Creates and configures a Pino logger instance.
 * In development, it uses pino-pretty for readable console output.
 * In production, it logs as highly-performant JSON.
 *
 * @param env - The current environment (e.g., 'development' or 'production').
 * @returns A configured Pino Logger instance.
 */
const createLogger = (env) => {
    const isDev = env === 'development';
    return (0, pino_1.default)({
        level: isDev ? 'debug' : 'info',
        transport: isDev
            ? {
                target: 'pino-pretty',
                options: {
                    colorize: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname',
                },
            }
            : undefined,
        formatters: {
            level: (label) => {
                return { level: label.toUpperCase() };
            },
            bindings: (bindings) => {
                return { pid: bindings.pid, host: bindings.hostname };
            },
        },
        timestamp: pino_1.default.stdTimeFunctions.isoTime,
    });
};
exports.createLogger = createLogger;
