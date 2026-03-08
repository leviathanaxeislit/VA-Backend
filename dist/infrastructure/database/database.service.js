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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const dns = __importStar(require("node:dns"));
const call_metrics_model_1 = require("./models/call-metrics.model");
/**
 * Service responsible for managing the MongoDB connection and providing
 * repository-like access to the CallMetrics collection.
 */
class DatabaseService {
    logger;
    uri;
    isConnected = false;
    constructor(config, logger) {
        this.logger = logger;
        this.uri = config.get('MONGO_URI');
    }
    /**
     * Initializes the MongoDB connection via Mongoose.
     * Ensures the singleton metrics document exists.
     */
    async connect() {
        if (this.isConnected)
            return;
        try {
            this.logger.info('Connecting to MongoDB...');
            // Fix for Windows querySrv ECONNREFUSED with MongoDB Atlas
            // Forces Node.js to use public DNS resolvers instead of potentially broken local ISP DNS
            dns.setServers(['8.8.8.8', '1.1.1.1']);
            await mongoose_1.default.connect(this.uri);
            this.isConnected = true;
            this.logger.info('Successfully connected to MongoDB.');
            // Ensure the singleton metrics document exists
            await this.ensureMetricsDocumentExists();
        }
        catch (error) {
            this.logger.error({ err: error }, 'Failed to connect to MongoDB');
            throw new Error('Database connection failed');
        }
    }
    /**
     * Gracefully close the MongoDB connection.
     */
    async disconnect() {
        if (!this.isConnected)
            return;
        try {
            await mongoose_1.default.disconnect();
            this.isConnected = false;
            this.logger.info('Disconnected from MongoDB.');
        }
        catch (error) {
            this.logger.error({ err: error }, 'Error disconnecting from MongoDB');
        }
    }
    /**
     * Checks if the database connection is currently active.
     */
    async isHealthy() {
        return mongoose_1.default.connection.readyState === 1;
    }
    // --- Repository Methods for CallMetrics ---
    /**
     * Increments the total number of calls attended by the bot.
     */
    async incrementCallsAttended() {
        try {
            await call_metrics_model_1.CallMetricsModel.findOneAndUpdate({}, {
                $inc: { calls_attended: 1 },
                $set: { last_updated: new Date() }
            }, { upsert: true, new: true });
            this.logger.debug('Incremented calls_attended metric.');
        }
        catch (error) {
            this.logger.error({ err: error }, 'Failed to increment calls_attended');
        }
    }
    /**
     * Increments the total number of calls that were deflected to a human agent.
     */
    async incrementCallsDeflected() {
        try {
            await call_metrics_model_1.CallMetricsModel.findOneAndUpdate({}, {
                $inc: { calls_deflected: 1 },
                $set: { last_updated: new Date() }
            }, { upsert: true, new: true });
            this.logger.debug('Incremented calls_deflected metric.');
        }
        catch (error) {
            this.logger.error({ err: error }, 'Failed to increment calls_deflected');
        }
    }
    /**
     * Retrieves the current call metrics stats for the dashboard.
     */
    async getMetrics() {
        try {
            return await call_metrics_model_1.CallMetricsModel.findOne({}).lean();
        }
        catch (error) {
            this.logger.error({ err: error }, 'Failed to retrieve metrics');
            return null;
        }
    }
    /**
     * Internal helper to create the initial document if the collection is empty.
     */
    async ensureMetricsDocumentExists() {
        const existing = await call_metrics_model_1.CallMetricsModel.findOne({});
        if (!existing) {
            await call_metrics_model_1.CallMetricsModel.create({
                calls_attended: 0,
                calls_deflected: 0,
                last_updated: new Date(),
            });
            this.logger.info('Initialized CallMetrics singleton document in MongoDB.');
        }
    }
}
exports.DatabaseService = DatabaseService;
