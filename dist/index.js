"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const agents_1 = require("@livekit/agents");
const logger_1 = require("./utils/logger");
const config_service_1 = require("./infrastructure/config.service");
const database_service_1 = require("./infrastructure/database/database.service");
const app_1 = require("./app");
const path = __importStar(require("path"));
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
        logger.info(`🚀 Fastify API Server is fully operational and listening on http://${host}:${port}`);
        // Start LiveKit Worker Programmatically in the background
        logger.info('Spawning LiveKit agent worker process natively...');
        // Inject 'start' into process.argv so the LiveKit CLI knows to run in production mode
        // rather than printing the help menu and crashing Fastify.
        if (!process.argv.includes('start') && !process.argv.includes('dev')) {
            process.argv.push('start');
        }
        agents_1.cli.runApp(new agents_1.WorkerOptions({
            agent: path.join(__dirname, 'agent.js'),
        }));
        logger.info('LiveKit Voice Agent successfully attached to the API process.');
    }
    catch (error) {
        bootstrapLogger.fatal({ err: error }, 'Fatal error during application startup. Process terminating.');
        process.exit(1);
    }
}
// Execute the bootstrap sequence
startServer();
