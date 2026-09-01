import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { AccessToken, AgentDispatchClient, RoomServiceClient } from 'livekit-server-sdk';

@Injectable()
export class LivekitService {
  private readonly logger = new Logger(LivekitService.name);

  private get config() {
    const url = process.env.LIVEKIT_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    if (!url || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException(
        'Video calling is not configured yet for this server (LIVEKIT_URL/LIVEKIT_API_KEY/LIVEKIT_API_SECRET missing).',
      );
    }
    return { url, apiKey, apiSecret };
  }

  // RoomServiceClient (used only to forcibly end a call for everyone) talks
  // over plain HTTPS, while LIVEKIT_URL is the wss:// URL clients use to
  // connect - swap the scheme rather than requiring a second env var.
  private get httpUrl() {
    return this.config.url.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://');
  }

  async mintToken(opts: { roomName: string; identity: string; name: string; canPublish: boolean }) {
    const { apiKey, apiSecret, url } = this.config;
    const at = new AccessToken(apiKey, apiSecret, { identity: opts.identity, name: opts.name });
    at.addGrant({
      room: opts.roomName,
      roomJoin: true,
      canPublish: opts.canPublish,
      canPublishData: true,
      canSubscribe: true,
    });
    const token = await at.toJwt();
    return { token, url };
  }

  async endRoom(roomName: string) {
    const { apiKey, apiSecret } = this.config;
    const client = new RoomServiceClient(this.httpUrl, apiKey, apiSecret);
    try {
      await client.deleteRoom(roomName);
    } catch {
      // Room may already be empty/gone (LiveKit auto-cleans idle rooms) -
      // that's fine, our own ChatCall row is the source of truth for status.
    }
  }

  // Returns how many participants are currently in the room - used by
  // ChatCallService's fallback timer to decide whether anyone besides the
  // caller ever joined before dispatching the AI. Returns 0 (not an error) if
  // the room doesn't exist yet/anymore, so the caller doesn't need a try/catch.
  async participantCount(roomName: string): Promise<number> {
    const { apiKey, apiSecret } = this.config;
    const client = new RoomServiceClient(this.httpUrl, apiKey, apiSecret);
    try {
      const participants = await client.listParticipants(roomName);
      return participants.length;
    } catch {
      return 0;
    }
  }

  // Milestone 10c - explicit agent dispatch. The voice-ai-agent Python worker
  // registers itself with LiveKit Cloud under LIVEKIT_AI_AGENT_NAME and does
  // NOT auto-join every room (explicit dispatch, not automatic) - it only
  // enters a specific room when we call this, which ChatCallService does
  // after its fallback timeout finds nobody else joined the call. `metadata`
  // is a JSON string the worker reads in its entrypoint job context to know
  // which thread/school/call this is and which tools/API keys to use.
  async dispatchAgent(roomName: string, agentName: string, metadata: string) {
    const { apiKey, apiSecret } = this.config;
    const client = new AgentDispatchClient(this.httpUrl, apiKey, apiSecret);
    try {
      return await client.createDispatch(roomName, agentName, { metadata });
    } catch (err) {
      this.logger.error(`Failed to dispatch AI agent "${agentName}" into room "${roomName}": ${(err as Error).message}`);
      throw err;
    }
  }
}
