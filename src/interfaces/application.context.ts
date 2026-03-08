import { Logger } from 'pino';
import { ConfigService } from '../infrastructure/config.service';
import { DatabaseService } from '../infrastructure/database/database.service';

/**
 * Defines the core dependencies available across the application.
 * This structure enforces Dependency Injection throughout the Fastify controllers and services.
 */
export interface ApplicationContext {
  /** The centralized Pino logger instance */
  logger: Logger;
  /** The Zod-validated configuration service */
  config: ConfigService;
  /** Database Service for tracking call metrics */
  db: DatabaseService;
  // Additional services (Gemini client, Twilio helpers, etc.) will be added here
}
