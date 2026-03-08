"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceController = VoiceController;
const gemini_service_1 = require("../services/gemini/gemini.service");
/**
 * Controller handling real-time voice integration via Twilio.
 */
async function VoiceController(app, context) {
    /**
     * HTTP POST: Twilio Webhook for incoming voice calls.
     * Responds with TwiML to initiate a WebSocket media stream.
     */
    app.post('/incoming-call', async (request, reply) => {
        try {
            // 1. Increment calls attended metric
            await context.db.incrementCallsAttended();
            context.logger.info({ callSid: request.body?.CallSid }, 'Incoming call received');
            // 2. Generate TwiML to connect to our fastify-websocket endpoint
            const host = request.headers.host || 'localhost:3000';
            const wsUrl = `wss://${host}/media-stream`;
            const twiml = `
        <Response>
          <Connect>
            <Stream url="${wsUrl}" />
          </Connect>
        </Response>
      `;
            return reply
                .type('text/xml')
                .send(twiml);
        }
        catch (error) {
            context.logger.error({ err: error }, 'Error processing incoming call');
            // Minimal fallback to avoid ringing forever
            return reply.type('text/xml').send('<Response><Say>Sorry, an error occurred.</Say></Response>');
        }
    });
    /**
     * WebSocket: handles the bi-directional audio stream with Twilio.
     */
    app.get('/media-stream', { websocket: true }, (connection) => {
        context.logger.info('Twilio Media Stream WebSocket connected');
        let streamSid = null;
        let geminiService = null;
        // Callback when Gemini sends audio back
        const onGeminiAudio = (audioPcmBase64) => {
            if (streamSid) {
                // Build Twilio Media message
                // Twilio Media Streams expect payload in base64-encoded mulaw or basic format depending on negotiation.
                // Assuming Gemini output needs to be wrapped for Twilio here.
                const audioMsg = {
                    event: 'media',
                    streamSid: streamSid,
                    media: {
                        payload: audioPcmBase64
                        // NOTE: We might need PCMU decoding/encoding here if Gemini is raw PCM and Twilio expects PCMU (mulaw). 
                        // For now, we are passing it directly. In production, an audio converter service would sit here.
                    }
                };
                connection.socket.send(JSON.stringify(audioMsg));
            }
        };
        // Callback when Gemini invokes tool 'transfer_to_agent'
        const onTransferToAgent = async () => {
            context.logger.info({ streamSid }, 'Executing human deflection tool call...');
            await context.db.incrementCallsDeflected();
            // Tell Twilio to stop the stream and hangup (by closing the socket, or sending a command)
            // Twilio docs: To hang up, you could send a Mark event or clear the stream.
            // Easiest way in pure sockets is just to close from our end. Let's send a Mark first to drain audio.
            if (streamSid) {
                connection.socket.send(JSON.stringify({
                    event: "mark",
                    streamSid: streamSid,
                    mark: { name: "deflection_initiated" }
                }));
            }
            // We wait for the 'mark' event back before closing, or just close after a tiny delay
            setTimeout(() => {
                connection.socket.close();
            }, 500);
        };
        // Initialize Gemini 
        geminiService = new gemini_service_1.GeminiLiveService(context, onGeminiAudio, onTransferToAgent);
        // Connect to Gemini
        geminiService.initialize().catch((err) => {
            context.logger.error({ err }, 'Failed to initialize Gemini Live API');
            connection.socket.close();
        });
        // Handle Twilio Messages
        connection.socket.on('message', (message) => {
            try {
                const msg = JSON.parse(message.toString());
                switch (msg.event) {
                    case 'start':
                        streamSid = msg.start.streamSid;
                        context.logger.info({ streamSid }, 'Twilio Media Stream Started');
                        break;
                    case 'media':
                        if (geminiService) {
                            // Twilio sends: msg.media.payload (base64 encoded audio)
                            geminiService.sendAudioChunk(msg.media.payload);
                        }
                        break;
                    case 'stop':
                        context.logger.info({ streamSid }, 'Twilio Media Stream Stopped');
                        if (geminiService)
                            geminiService.close();
                        break;
                    case 'mark':
                        // mark received
                        break;
                }
            }
            catch (err) {
                context.logger.error({ err }, 'Error parsing Twilio WS message');
            }
        });
        connection.socket.on('close', () => {
            context.logger.info('Twilio Media Stream WebSocket closed');
            if (geminiService)
                geminiService.close();
        });
        connection.socket.on('error', (err) => {
            context.logger.error({ err }, 'Twilio Media Stream WebSocket error');
            if (geminiService)
                geminiService.close();
        });
    });
}
