import { createLogger } from './utils/logger';
import { ConfigService } from './infrastructure/config.service';
import { DatabaseService } from './infrastructure/database/database.service';
import { ApplicationContext } from './interfaces/application.context';
import { buildApp } from './app';

/**
 * Application Entry Point.
 * Assembles the Dependency Injection container, builds the Fastify server,
 * and starts listening for incoming requests.
 */
async function startServer() {
  // Temporary bootstrap logger before we know the environment
  const bootstrapLogger = createLogger('development');

  try {
    bootstrapLogger.info('Initializing Configuration Service...');
    const config = new ConfigService(bootstrapLogger);
    
    // Now that we have config, re-initialize logger matching the requested environment
    const currentEnv = config.get('NODE_ENV');
    const logger = createLogger(currentEnv);
    logger.info(`Starting application in [${currentEnv}] environment`);

    // Initialize Database Connections here (MongoDB)
    const db = new DatabaseService(config, logger);
    await db.connect();

    // Assemble the Dependency Injection Context
    const context: ApplicationContext = {
      logger,
      config,
      db,
    };

    logger.info('Building Fastify application...');
    const app = await buildApp(context);

    // Trap interrupt signals for graceful shutdown
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
    for (const signal of signals) {
      process.on(signal, async () => {
        logger.info(`Received ${signal}, initiating graceful shutdown...`);
        try {
          await app.close();
          await db.disconnect();
          logger.info('Fastify instance closed successfully. Exiting.');
          process.exit(0);
        } catch (err) {
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

  } catch (error) {
    bootstrapLogger.fatal({ err: error }, 'Fatal error during application startup. Process terminating.');
    process.exit(1);
  }
}

// Execute the bootstrap sequence
startServer();
