import {
  type JobContext,
  WorkerOptions,
  cli,
  llm,
  voice,
  defineAgent
} from '@livekit/agents';
import * as dotenv from 'dotenv';
import * as google from '@livekit/agents-plugin-google';
import { generateSystemPrompt } from './services/prompts/systemPrompt';
import { DatabaseService } from './infrastructure/database/database.service';
import { ConfigService } from './infrastructure/config.service';
import { createLogger } from './utils/logger';

// Load env vars
dotenv.config();

export default defineAgent({
  entry: async (ctx: JobContext) => {
  await ctx.connect();
  console.log(`Room connected: ${ctx.room.name}`);

  // Setup services for DB access within the worker
  const logger = createLogger('production');
  const config = new ConfigService(logger);
  const db = new DatabaseService(config, logger);
  await db.connect();

  // Register graceful DB shutdown when the worker process exits
  ctx.addShutdownCallback(async () => {
    logger.info('Worker process shutting down, disconnecting from DB...');
    await db.disconnect();
  });

  // Increment call attended
  await db.incrementCallsAttended();

  // Define Function Context for tools using LiveKit 1.0 Syntax
  const fnCtx: llm.ToolContext = {
    transfer_call: llm.tool({
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
    }),
    end_call: llm.tool({
      description: 'Call this function to end/disconnect the call when the user is idle, unresponsive, or the conversation is over.',
      execute: async () => {
        logger.info('Call ended by agent: end_call called due to idle or end of conversation');
        
        // Tell the frontend we are ending the call
        const encoder = new TextEncoder();
        const payload = encoder.encode(JSON.stringify({ type: 'disconnect' }));
        if (ctx.room.localParticipant) {
          await ctx.room.localParticipant.publishData(payload, { reliable: true });
        }

        // Delay disconnection to allow the agent to finish its sentence
        setTimeout(() => {
          ctx.room.disconnect();
        }, 3000);
        
        return 'The call is being disconnected. Please say a final goodbye and end your response.';
      }
    })
  };

  // Initialize the Gemini Multimodal Agent via LiveKit AgentSession
  const session = new voice.AgentSession({
    llm: new google.beta.realtime.RealtimeModel({
      model: "gemini-2.5-flash-native-audio-preview-12-2025",
      apiKey: process.env.GEMINI_API_KEY,
    })
  });

  session.on(voice.AgentSessionEventTypes.Error, (err: any) => {
    logger.error({ err }, 'AgentSession encountered an error');
  });

  // Start the session when room is ready
  try {
    await session.start({
      agent: new voice.Agent({
        instructions: generateSystemPrompt(),
        tools: fnCtx
      }),
      room: ctx.room,
    });
    logger.info('AgentSession started successfully.');

    // Prompt the agent to initiate the conversation
    session.generateReply();
  } catch (err) {
    logger.error({ err }, 'Failed to start AgentSession');
  }

  // Handle room disconnection
  ctx.room.on('disconnected', async () => {
    console.log(`Room disconnected: ${ctx.room.name}`);
    try {
      await session.close();
    } catch (err) {
      logger.error({ err }, 'Error closing AgentSession');
    }
  });
}
});


// Run via CLI if executed directly (e.g. `tsx watch src/agent.ts dev`)
if (require.main === module) {
  cli.runApp(new WorkerOptions({
    agent: __filename,
  }));
}
