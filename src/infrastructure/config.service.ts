import { z } from 'zod';
import * as dotenv from 'dotenv';
import { Logger } from 'pino';

// Load environment variables from .env file immediately
dotenv.config();

/**
 * Zod schema for validating the environment variables ensuring all required
 * variables are present and correctly formatted at startup.
 */
const envSchema = z.object({
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required for the Gemini Live API'),
  MONGO_URI: z.string().url('MONGO_URI must be a valid connection string'),
  LIVEKIT_URL: z.string().url('LIVEKIT_URL is required'),
  LIVEKIT_API_KEY: z.string().min(1, 'LIVEKIT_API_KEY is required'),
  LIVEKIT_API_SECRET: z.string().min(1, 'LIVEKIT_API_SECRET is required'),
  PORT: z.string().regex(/^\d+$/).transform(Number).default(3000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Configuration Service responsible for parsing, validating, and exposing
 * environment configuration securely across the application.
 * Designed to be injected via Dependency Injection.
 */
export class ConfigService {
  private readonly config: EnvConfig;

  constructor(private readonly logger: Logger) {
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
  public get<K extends keyof EnvConfig>(key: K): EnvConfig[K] {
    return this.config[key];
  }

  /**
   * Retrieves the entire validated configuration object.
   * 
   * @returns The full configuration object.
   */
  public getAll(): EnvConfig {
    return this.config;
  }
}
