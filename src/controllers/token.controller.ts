import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AccessToken } from 'livekit-server-sdk';
import * as crypto from 'node:crypto';
import { ApplicationContext } from '../interfaces/application.context';

export async function TokenController(app: FastifyInstance, context: ApplicationContext) {
  
  app.get('/api/token', async (_request: FastifyRequest, reply: FastifyReply) => {
    // Generate a secure JWT using livekit-server-sdk
    const roomName = `wise-support-room-${crypto.randomUUID()}`;
    
    // Create random participant name
    const participantName = `participant_${Math.floor(Math.random() * 10000)}`;

    const at = new AccessToken(
      context.config.get('LIVEKIT_API_KEY'),
      context.config.get('LIVEKIT_API_SECRET'),
      {
        identity: participantName,
        name: participantName,
      }
    );

    // Grant permissions to join the specific room and publish/subscribe to tracks
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();

    return reply.send({ token });
  });

}
