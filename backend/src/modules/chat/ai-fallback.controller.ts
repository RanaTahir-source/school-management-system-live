import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ChatCallService } from './chat-call.service';
import { AiPostMessageDto } from './dto/ai-post-message.dto';
import { AiEndCallDto } from './dto/ai-end-call.dto';
import { AiNotetakerFinalizeDto } from './dto/ai-notetaker-finalize.dto';
import { ServiceApiKeyGuard } from '../../common/guards/service-api-key.guard';

// Milestone 10c - called only by voice-ai-agent (the Python LiveKit Agents
// worker), never by a browser or a logged-in user - there's no JWT to check
// here, so this reuses the same trusted-peer-service pattern as
// voice-integration (ServiceApiKeyGuard + VOICE_AGENT_INTEGRATION_KEY),
// rather than introducing a third shared secret for what is functionally the
// same trust boundary: "a backend service we run, not a person".
@Controller('chat/ai')
@UseGuards(ServiceApiKeyGuard)
export class AiFallbackController {
  constructor(private readonly chatCallService: ChatCallService) {}

  // The agent posts its spoken replies (or a short "here's what I did"
  // summary) into the thread as a normal-looking chat message, so anyone who
  // opens the conversation later sees a readable log of what the AI said,
  // not just silence followed by "call ended".
  @Post('messages')
  postMessage(@Body() dto: AiPostMessageDto) {
    return this.chatCallService.postAiMessage(dto.callId, dto.body);
  }

  // The agent hangs up once it's done (answered fully, logged a callback
  // request and told the caller someone will call back, or the caller left)
  // - optionally attaching a transcript/summary onto the ChatCall row.
  @Post('end-call')
  endCall(@Body() dto: AiEndCallDto) {
    return this.chatCallService.endCallByAgent(dto.callId, dto.transcript, dto.summary);
  }

  // Milestone 10d - the notetaker calls this once it's generated meeting
  // minutes (detects the meeting winding down itself - see voice-ai-agent).
  // Does NOT end the call or touch its status - purely records what was said.
  @Post('notetaker/finalize')
  finalizeNotes(@Body() dto: AiNotetakerFinalizeDto) {
    return this.chatCallService.saveNotetakerOutput(dto.callId, dto.transcript, dto.summary);
  }
}
