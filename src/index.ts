import { cli, WorkerOptions } from '@livekit/agents';
import { createLogger } from './utils/logger';
import { ConfigService } from './infrastructure/config.service';
import { DatabaseService } from './infrastructure/database/database.service';
import { ApplicationContext } from './interfaces/application.context';
import { buildApp } from './app';
import * as path from 'path';

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
    logger.info(`🚀 Fastify API Server is fully operational and listening on http://${host}:${port}`);

    // Start LiveKit Worker Programmatically in the background for production
    if (currentEnv === 'production') {
      logger.info('Spawning LiveKit agent worker process natively...');

      // Inject 'start' into process.argv so the LiveKit CLI knows to run in production mode
      // rather than printing the help menu and crashing Fastify.
      if (!process.argv.includes('start') && !process.argv.includes('dev')) {
        process.argv.push('start');
      }

      cli.runApp(new WorkerOptions({
        agent: path.join(__dirname, 'agent.js'),
      }));
      logger.info('LiveKit Voice Agent successfully attached to the API process.');
    } else {
      logger.info(`Running in [${currentEnv}] mode; skipping embedded LiveKit Voice Agent worker (managed via concurrently).`);
    }

  } catch (error) {
    bootstrapLogger.fatal({ err: error }, 'Fatal error during application startup. Process terminating.');
    process.exit(1);
  }
}

// Execute the bootstrap sequence
startServer();
