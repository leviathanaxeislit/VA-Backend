import Fastify, { FastifyRequest, FastifyReply, FastifyError } from 'fastify';
import cors from '@fastify/cors';
import { ApplicationContext } from './interfaces/application.context';
import { MetricsController } from './controllers/metrics.controller';
import { TokenController } from './controllers/token.controller';

/**
 * Bootstraps and configures the Fastify server instance.
 *
 * @param context - The global dependencies (logger, config, services).
 * @returns A fully configured, ready-to-listen FastifyInstance.
 */
export async function buildApp(context: ApplicationContext) {
  const app = Fastify({
    loggerInstance: context.logger,
    disableRequestLogging: true, // We will handle request logging via custom hooks for better control
  });

  // Register essential plugins
  await app.register(cors, { 
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'Accept'],
    credentials: true,
  });
  // --- Global Hooks for Request/Response Logging & Tracing ---

  // Generate a unique reqId or use the one provided by Twilio/proxies
  app.addHook('onRequest', async (req: FastifyRequest) => {
    req.id = Array.isArray(req.headers['x-request-id'])
      ? req.headers['x-request-id'][0] // Take the first if it's an array
      : (req.headers['x-request-id'] as string) || req.id;
  });

  app.addHook('onResponse', async (req: FastifyRequest, reply: FastifyReply) => {
    context.logger.info({
      reqId: req.id,
      method: req.method,
      url: req.url,
      statusCode: reply.statusCode,
      responseTime: reply.elapsedTime,
    }, 'Request completed');
  });

  // --- Global Error Handling Middleware ---
  app.setErrorHandler((error: FastifyError, request, reply) => {
    context.logger.error({ 
      reqId: request.id, 
      err: error, 
      url: request.url 
    }, 'Unhandled exception occurred');

    const statusCode = error.statusCode || 500;
    const message = statusCode === 500 && context.config.get('NODE_ENV') === 'production'
      ? 'Internal Server Error'
      : error.message;

    reply.status(statusCode).send({
      error: {
        message,
        statusCode,
        reqId: request.id,
      },
    });
  });

  // --- Core utility endpoints ---

  /**
   * Defines a generic health check endpoint to verify server responsiveness.
   * Will be expanded to include MongoDB and external API connectivity status.
   */
  app.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    const isDbHealthy = await context.db.isHealthy();
    
    const status = isDbHealthy ? 'OK' : 'ERROR';
    const statusCode = isDbHealthy ? 200 : 503;

    return reply.status(statusCode).send({
      status,
      timestamp: new Date().toISOString(),
      environment: context.config.get('NODE_ENV'),
      components: {
        mongodb: isDbHealthy ? 'connected' : 'disconnected'
      }
    });
  });

  // Register application-specific routes
  await app.register((instance) => MetricsController(instance, context));
  await app.register((instance) => TokenController(instance, context));

  return app;
}
