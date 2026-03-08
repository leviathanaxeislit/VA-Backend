import pino, { Logger } from 'pino';

/**
 * Creates and configures a Pino logger instance.
 * In development, it uses pino-pretty for readable console output.
 * In production, it logs as highly-performant JSON.
 *
 * @param env - The current environment (e.g., 'development' or 'production').
 * @returns A configured Pino Logger instance.
 */
export const createLogger = (env: string): Logger => {
  const isDev = env === 'development';

  return pino({
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
    timestamp: pino.stdTimeFunctions.isoTime,
  });
};
