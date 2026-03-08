"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiLiveService = void 0;
const ws_1 = __importDefault(require("ws"));
const systemPrompt_1 = require("../prompts/systemPrompt");
/**
 * Service to manage the WebSocket connection to the Gemini Multimodal Live API.
 */
class GeminiLiveService {
    context;
    onAudioResponse;
    onTransferToAgent;
    wsUrl = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent';
    ws = null;
    constructor(context, onAudioResponse, onTransferToAgent) {
        this.context = context;
        this.onAudioResponse = onAudioResponse;
        this.onTransferToAgent = onTransferToAgent;
    }
    /**
     * Initializes the connection to Gemini.
     */
    async initialize() {
        const apiKey = this.context.config.get('GEMINI_API_KEY');
        this.ws = new ws_1.default(`${this.wsUrl}?key=${apiKey}`);
        return new Promise((resolve, reject) => {
            this.ws.on('open', () => {
                this.context.logger.info('Connected to Gemini Live API WebSocket');
                this.sendSetupMessage();
                resolve();
            });
            this.ws.on('message', (data) => {
                this.handleMessage(data);
            });
            this.ws.on('error', (err) => {
                this.context.logger.error({ err }, 'Gemini Live API WebSocket Error');
                reject(err);
            });
            this.ws.on('close', () => {
                this.context.logger.info('Gemini Live API WebSocket Closed');
            });
        });
    }
    /**
     * Sends audio chunks (raw PCM 16-bit 16kHz base64) to Gemini.
     */
    sendAudioChunk(base64Pcm) {
        if (!this.ws || this.ws.readyState !== ws_1.default.OPEN) {
            return;
        }
        const payload = {
            realtimeInput: {
                mediaChunks: [{
                        mimeType: 'audio/pcm;rate=16000',
                        data: base64Pcm
                    }]
            }
        };
        this.ws.send(JSON.stringify(payload));
    }
    /**
     * Closes the connection.
     */
    close() {
        if (this.ws && this.ws.readyState === ws_1.default.OPEN) {
            this.ws.close();
        }
    }
    /**
     * Internal: Sends the initial Setup configuration to Gemini including tools and system instructions.
     */
    sendSetupMessage() {
        const setupMessage = {
            setup: {
                model: 'models/gemini-2.0-flash-exp', // Or the optimal live model as per docs
                systemInstruction: {
                    parts: [{ text: (0, systemPrompt_1.generateSystemPrompt)() }]
                },
                tools: [
                    {
                        functionDeclarations: [
                            {
                                name: 'transfer_to_agent',
                                description: 'Transfers the user to a human customer support agent when their question requires human intervention or is outside the "Where is my money?" knowledge base.'
                            }
                        ]
                    }
                ]
            }
        };
        this.ws.send(JSON.stringify(setupMessage));
        this.context.logger.debug('Sent Gemini setup configuration');
    }
    /**
     * Internal: Processes incoming messages from Gemini.
     */
    async handleMessage(data) {
        try {
            const response = JSON.parse(data.toString());
            // 1. Handle Audio output
            if (response.serverContent?.modelTurn?.parts) {
                for (const part of response.serverContent.modelTurn.parts) {
                    if (part.inlineData && part.inlineData.data) {
                        // Found audio data: Base64 PCM 16kHz
                        this.onAudioResponse(part.inlineData.data);
                    }
                }
            }
            // 2. Handle Tool Calls
            if (response.toolCall?.functionCalls) {
                for (const call of response.toolCall.functionCalls) {
                    if (call.name === 'transfer_to_agent') {
                        this.context.logger.info('Gemini invoked transfer_to_agent. Executing callback...');
                        // First, acknowledge the tool call back to Gemini
                        const toolResponse = {
                            toolResponse: {
                                functionResponses: [{
                                        id: call.id,
                                        name: call.name,
                                        response: { result: "Transfer initiated successfully." }
                                    }]
                            }
                        };
                        this.ws.send(JSON.stringify(toolResponse));
                        // Trigger action upstream
                        this.onTransferToAgent();
                    }
                }
            }
        }
        catch (err) {
            this.context.logger.error({ err }, 'Error parsing Gemini message');
        }
    }
}
exports.GeminiLiveService = GeminiLiveService;
