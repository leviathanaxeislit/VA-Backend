"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildApp = buildApp;
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const metrics_controller_1 = require("./controllers/metrics.controller");
const token_controller_1 = require("./controllers/token.controller");
/**
 * Bootstraps and configures the Fastify server instance.
 *
 * @param context - The global dependencies (logger, config, services).
 * @returns A fully configured, ready-to-listen FastifyInstance.
 */
async function buildApp(context) {
    const app = (0, fastify_1.default)({
        loggerInstance: context.logger,
        disableRequestLogging: true, // We will handle request logging via custom hooks for better control
    });
    // Register essential plugins
    await app.register(cors_1.default, {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'Accept'],
        credentials: true,
    });
    // --- Global Hooks for Request/Response Logging & Tracing ---
    // Generate a unique reqId or use the one provided by Twilio/proxies
    app.addHook('onRequest', async (req) => {
        req.id = Array.isArray(req.headers['x-request-id'])
            ? req.headers['x-request-id'][0] // Take the first if it's an array
            : req.headers['x-request-id'] || req.id;
    });
    app.addHook('onResponse', async (req, reply) => {
        context.logger.info({
            reqId: req.id,
            method: req.method,
            url: req.url,
            statusCode: reply.statusCode,
            responseTime: reply.elapsedTime,
        }, 'Request completed');
    });
    // --- Global Error Handling Middleware ---
    app.setErrorHandler((error, request, reply) => {
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
    app.get('/health', async (_request, reply) => {
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
    await app.register((instance) => (0, metrics_controller_1.MetricsController)(instance, context));
    await app.register((instance) => (0, token_controller_1.TokenController)(instance, context));
    return app;
}
