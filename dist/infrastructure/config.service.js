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
exports.ConfigService = void 0;
const zod_1 = require("zod");
const dotenv = __importStar(require("dotenv"));
// Load environment variables from .env file immediately
dotenv.config();
/**
 * Zod schema for validating the environment variables ensuring all required
 * variables are present and correctly formatted at startup.
 */
const envSchema = zod_1.z.object({
    GEMINI_API_KEY: zod_1.z.string().min(1, 'GEMINI_API_KEY is required for the Gemini Live API'),
    MONGO_URI: zod_1.z.string().url('MONGO_URI must be a valid connection string'),
    LIVEKIT_URL: zod_1.z.string().url('LIVEKIT_URL is required'),
    LIVEKIT_API_KEY: zod_1.z.string().min(1, 'LIVEKIT_API_KEY is required'),
    LIVEKIT_API_SECRET: zod_1.z.string().min(1, 'LIVEKIT_API_SECRET is required'),
    PORT: zod_1.z.string().regex(/^\d+$/).transform(Number).default(3000),
    HOST: zod_1.z.string().default('0.0.0.0'),
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
});
/**
 * Configuration Service responsible for parsing, validating, and exposing
 * environment configuration securely across the application.
 * Designed to be injected via Dependency Injection.
 */
class ConfigService {
    logger;
    config;
    constructor(logger) {
        this.logger = logger;
        const parsed = envSchema.safeParse(process.env);
        if (!parsed.success) {
            this.logger.fatal({
                msg: 'Invalid environment configuration detected on startup',
                errors: parsed.error.format()
            });
            throw new Error('ConfigService Initialization Error: Invalid environment configuration');
        }
        this.config = parsed.data;
        this.logger.info('Environment configuration loaded and validated successfully via Zod.');
    }
    /**
     * Retrieve a strongly-typed configuration value.
     *
     * @param key - The key of the configuration to retrieve.
     * @returns The validated value of the requested configuration.
     */
    get(key) {
        return this.config[key];
    }
    /**
     * Retrieves the entire validated configuration object.
     *
     * @returns The full configuration object.
     */
    getAll() {
        return this.config;
    }
}
exports.ConfigService = ConfigService;
