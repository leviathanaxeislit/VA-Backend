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
const agents_1 = require("@livekit/agents");
const dotenv = __importStar(require("dotenv"));
const google = __importStar(require("@livekit/agents-plugin-google"));
const systemPrompt_1 = require("./services/prompts/systemPrompt");
const database_service_1 = require("./infrastructure/database/database.service");
const config_service_1 = require("./infrastructure/config.service");
const logger_1 = require("./utils/logger");
// Load env vars
dotenv.config();
exports.default = (0, agents_1.defineAgent)({
    entry: async (ctx) => {
        await ctx.connect();
        console.log(`Room connected: ${ctx.room.name}`);
        // Setup services for DB access within the worker
        const logger = (0, logger_1.createLogger)('production');
        const config = new config_service_1.ConfigService(logger);
        const db = new database_service_1.DatabaseService(config, logger);
        await db.connect();
        // Register graceful DB shutdown when the worker process exits
        ctx.addShutdownCallback(async () => {
            logger.info('Worker process shutting down, disconnecting from DB...');
            await db.disconnect();
        });
        // Increment call attended
        await db.incrementCallsAttended();
        // Define Function Context for tools using LiveKit 1.0 Syntax
        const fnCtx = {
            transfer_call: agents_1.llm.tool({
                description: 'Call this function to transfer the user to a human agent.',
                execute: async () => {
                    logger.info('Deflection triggered: transfer_call called');
                    await db.incrementCallsDeflected();
                    // Tell the frontend we are transferring
                    const encoder = new TextEncoder();
                    const payload = encoder.encode(JSON.stringify({ type: 'transfer' }));
                    if (ctx.room.localParticipant) {
                        await ctx.room.localParticipant.publishData(payload, { reliable: true });
                    }
                    // Delay disconnection to allow the agent to finish its sentence
                    setTimeout(() => {
                        ctx.room.disconnect();
                    }, 3000);
                    return 'The transfer has been initiated. Please say a final goodbye and end your response.';
                }
            })
        };
        // Initialize the Gemini Multimodal Agent via LiveKit AgentSession
        const session = new agents_1.voice.AgentSession({
            llm: new google.beta.realtime.RealtimeModel({
                model: "gemini-2.5-flash-native-audio-preview-12-2025",
                apiKey: process.env.GEMINI_API_KEY,
            })
        });
        session.on(agents_1.voice.AgentSessionEventTypes.Error, (err) => {
            logger.error({ err }, 'AgentSession encountered an error');
        });
        // Start the session when room is ready
        try {
            await session.start({
                agent: new agents_1.voice.Agent({
                    instructions: (0, systemPrompt_1.generateSystemPrompt)(),
                    tools: fnCtx
                }),
                room: ctx.room,
            });
            logger.info('AgentSession started successfully.');
            // Prompt the agent to initiate the conversation
            session.generateReply();
        }
        catch (err) {
            logger.error({ err }, 'Failed to start AgentSession');
        }
        // Handle room disconnection
        ctx.room.on('disconnected', async () => {
            console.log(`Room disconnected: ${ctx.room.name}`);
            try {
                await session.close();
            }
            catch (err) {
                logger.error({ err }, 'Error closing AgentSession');
            }
        });
    }
});
// Run via CLI if executed directly (e.g. `tsx watch src/agent.ts dev`)
if (require.main === module) {
    agents_1.cli.runApp(new agents_1.WorkerOptions({
        agent: __filename,
    }));
}
