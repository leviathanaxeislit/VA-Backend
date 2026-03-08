"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("./utils/logger");
const config_service_1 = require("./infrastructure/config.service");
const database_service_1 = require("./infrastructure/database/database.service");
const app_1 = require("./app");
/**
 * Application Entry Point.
 * Assembles the Dependency Injection container, builds the Fastify server,
 * and starts listening for incoming requests.
 */
async function startServer() {
    // Temporary bootstrap logger before we know the environment
    const bootstrapLogger = (0, logger_1.createLogger)('development');
    try {
        bootstrapLogger.info('Initializing Configuration Service...');
        const config = new config_service_1.ConfigService(bootstrapLogger);
        // Now that we have config, re-initialize logger matching the requested environment
        const currentEnv = config.get('NODE_ENV');
        const logger = (0, logger_1.createLogger)(currentEnv);
        logger.info(`Starting application in [${currentEnv}] environment`);
        // Initialize Database Connections here (MongoDB)
        const db = new database_service_1.DatabaseService(config, logger);
        await db.connect();
        // Assemble the Dependency Injection Context
        const context = {
            logger,
            config,
            db,
        };
        logger.info('Building Fastify application...');
        const app = await (0, app_1.buildApp)(context);
        // Trap interrupt signals for graceful shutdown
        const signals = ['SIGINT', 'SIGTERM'];
        for (const signal of signals) {
            process.on(signal, async () => {
                logger.info(`Received ${signal}, initiating graceful shutdown...`);
                try {
                    await app.close();
                    await db.disconnect();
                    logger.info('Fastify instance closed successfully. Exiting.');
                    process.exit(0);
                }
                catch (err) {
                    logger.error({ err }, 'Error during graceful shutdown');
                    process.exit(1);
                }
            });
        }
        const port = config.get('PORT');
        const host = config.get('HOST');
        logger.info(`Attempting to bind server to http://${host}:${port}`);
        await app.listen({ port, host });
        // Fallback message, actual startup log is handled by app.listen() but this is explicit
        logger.info(`🚀 Agent Server is fully operational and listening on http://${host}:${port}`);
    }
    catch (error) {
        bootstrapLogger.fatal({ err: error }, 'Fatal error during application startup. Process terminating.');
        process.exit(1);
    }
}
// Execute the bootstrap sequence
startServer();
