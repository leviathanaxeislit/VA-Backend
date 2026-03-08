import mongoose from 'mongoose';
import * as dns from 'node:dns';
import { Logger } from 'pino';
import { ConfigService } from '../config.service';
import { CallMetricsModel, ICallMetrics } from './models/call-metrics.model';

/**
 * Service responsible for managing the MongoDB connection and providing
 * repository-like access to the CallMetrics collection.
 */
export class DatabaseService {
  private readonly logger: Logger;
  private readonly uri: string;
  private isConnected = false;

  constructor(config: ConfigService, logger: Logger) {
    this.logger = logger;
    this.uri = config.get('MONGO_URI');
  }

  /**
   * Initializes the MongoDB connection via Mongoose.
   * Ensures the singleton metrics document exists.
   */
  public async connect(): Promise<void> {
    if (this.isConnected) return;

    try {
      this.logger.info('Connecting to MongoDB...');
      
      // Fix for Windows querySrv ECONNREFUSED with MongoDB Atlas
      // Forces Node.js to use public DNS resolvers instead of potentially broken local ISP DNS
      dns.setServers(['8.8.8.8', '1.1.1.1']);
      
      await mongoose.connect(this.uri);
      this.isConnected = true;
      this.logger.info('Successfully connected to MongoDB.');

      // Ensure the singleton metrics document exists
      await this.ensureMetricsDocumentExists();
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to connect to MongoDB');
      throw new Error('Database connection failed');
    }
  }

  /**
   * Gracefully close the MongoDB connection.
   */
  public async disconnect(): Promise<void> {
    if (!this.isConnected) return;
    try {
      await mongoose.disconnect();
      this.isConnected = false;
      this.logger.info('Disconnected from MongoDB.');
    } catch (error) {
      this.logger.error({ err: error }, 'Error disconnecting from MongoDB');
    }
  }

  /**
   * Checks if the database connection is currently active.
   */
  public async isHealthy(): Promise<boolean> {
    return mongoose.connection.readyState === 1;
  }

  // --- Repository Methods for CallMetrics ---

  /**
   * Increments the total number of calls attended by the bot.
   */
  public async incrementCallsAttended(): Promise<void> {
    try {
      await CallMetricsModel.findOneAndUpdate(
        {}, 
        { 
          $inc: { calls_attended: 1 },
          $set: { last_updated: new Date() }
        }, 
        { upsert: true, new: true }
      );
      this.logger.debug('Incremented calls_attended metric.');
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to increment calls_attended');
    }
  }

  /**
   * Increments the total number of calls that were deflected to a human agent.
   */
  public async incrementCallsDeflected(): Promise<void> {
    try {
      await CallMetricsModel.findOneAndUpdate(
        {}, 
        { 
          $inc: { calls_deflected: 1 },
          $set: { last_updated: new Date() }
        }, 
        { upsert: true, new: true }
      );
      this.logger.debug('Incremented calls_deflected metric.');
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to increment calls_deflected');
    }
  }

  /**
   * Retrieves the current call metrics stats for the dashboard.
   */
  public async getMetrics(): Promise<ICallMetrics | null> {
    try {
      return await CallMetricsModel.findOne({}).lean();
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to retrieve metrics');
      return null;
    }
  }

  /**
   * Internal helper to create the initial document if the collection is empty.
   */
  private async ensureMetricsDocumentExists(): Promise<void> {
    const existing = await CallMetricsModel.findOne({});
    if (!existing) {
      await CallMetricsModel.create({
        calls_attended: 0,
        calls_deflected: 0,
        last_updated: new Date(),
      });
      this.logger.info('Initialized CallMetrics singleton document in MongoDB.');
    }
  }
}
