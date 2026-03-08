import { Schema, model, Document } from 'mongoose';

/**
 * Interface defining the structure of the CallMetrics document in MongoDB.
 */
export interface ICallMetrics extends Document {
  calls_attended: number;
  calls_deflected: number;
  last_updated: Date;
}

/**
 * Mongoose schema for the CallMetrics.
 * We store this as a single document singleton to easily track global stats.
 */
const CallMetricsSchema = new Schema<ICallMetrics>(
  {
    calls_attended: { type: Number, default: 0, required: true },
    calls_deflected: { type: Number, default: 0, required: true },
    last_updated: { type: Date, default: Date.now },
  },
  {
    timestamps: false, // We manually handle last_updated
  }
);


export const CallMetricsModel = model<ICallMetrics>('CallMetrics', CallMetricsSchema);

