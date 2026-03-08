"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallMetricsModel = void 0;
const mongoose_1 = require("mongoose");
/**
 * Mongoose schema for the CallMetrics.
 * We store this as a single document singleton to easily track global stats.
 */
const CallMetricsSchema = new mongoose_1.Schema({
    calls_attended: { type: Number, default: 0, required: true },
    calls_deflected: { type: Number, default: 0, required: true },
    last_updated: { type: Date, default: Date.now },
}, {
    timestamps: false, // We manually handle last_updated
});
exports.CallMetricsModel = (0, mongoose_1.model)('CallMetrics', CallMetricsSchema);
