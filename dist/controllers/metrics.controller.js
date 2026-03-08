"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsController = MetricsController;
/**
 * Controller serving the Metrics API for the Next.js Dashboard.
 */
async function MetricsController(app, context) {
    app.get('/api/metrics', async (_request, reply) => {
        try {
            const metrics = await context.db.getMetrics();
            if (!metrics) {
                return reply.status(200).send({
                    calls_attended: 0,
                    calls_deflected: 0,
                    last_updated: new Date()
                });
            }
            return reply.status(200).send({
                calls_attended: metrics.calls_attended,
                calls_deflected: metrics.calls_deflected,
                last_updated: metrics.last_updated
            });
        }
        catch (error) {
            context.logger.error({ err: error }, 'Error fetching metrics for dashboard');
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });
}
