import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScopedUser } from '../../common/utils/school-scope';
import { ChatService } from './chat.service';
import { LivekitService } from './livekit.service';
import { ChatGateway } from './chat.gateway';

const PERSON_SELECT = { id: true, fullName: true } as const;

@Injectable()
export class ChatCallService {
  private readonly logger = new Logger(ChatCallService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatService: ChatService,
    private readonly livekit: LivekitService,
    private readonly chatGateway: ChatGateway,
  ) {}

  private roomNameFor(threadId: string) {
    return `thread-${threadId}`;
  }

  // Milestone 10c - AI fallback call-answering config. Off by default: only
  // turn this on once voice-ai-agent is actually deployed and registered with
  // LiveKit Cloud under the same agent name, otherwise every unanswered call
  // would fail a dispatch call for nothing.
  private get aiFallbackEnabled() {
    return process.env.AI_FALLBACK_ENABLED === 'true';
  }

  private get aiFallbackTimeoutMs() {
    const seconds = Number(process.env.AI_FALLBACK_TIMEOUT_SECONDS ?? '45');
    return (Number.isFinite(seconds) && seconds > 0 ? seconds : 45) * 1000;
  }

  private get aiAgentName() {
    return process.env.LIVEKIT_AI_AGENT_NAME || 'school-ai-receptionist';
  }

  // Milestone 10d - AI meeting notetaker dispatch name. Deliberately a
  // separate agent_name from aiAgentName above even though both are served
  // by the same voice-ai-agent worker process (see agent.py) - LiveKit
  // routes dispatches by name, and the notetaker's behavior (silent,
  // transcribes, no voice reply) is different enough from the fallback
  // receptionist's that keeping them as distinct dispatch targets is clearer
  // than one entrypoint branching on a "mode" flag alone.
  private get notetakerAgentName() {
    return process.env.LIVEKIT_NOTETAKER_AGENT_NAME || 'school-ai-notetaker';
  }

  // Scoped to DIRECT (1:1) conversations only for now - this is the "front
  // desk didn't pick up the phone" scenario. Group/broadcast calls already
  // have several humans who might answer, and an AI joining a class-wide call
  // is a different (not yet requested) feature - can widen this later.
  private isAiFallbackEligible(threadType: string) {
    return threadType === 'DIRECT';
  }

  // Fired once, aiFallbackTimeoutMs after a call starts. Re-checks the call
  // is still active and nobody else ever joined the LiveKit room before
  // dispatching voice-ai-agent - deliberately re-reads everything from the
  // DB/LiveKit instead of trusting closure state, since a lot can happen in
  // 45 seconds.
  private scheduleAiFallback(callId: string, threadId: string) {
    if (!this.aiFallbackEnabled) return;

    setTimeout(async () => {
      try {
        const call = await this.prisma.chatCall.findUnique({ where: { id: callId } });
        if (!call || call.status !== 'ACTIVE' || call.aiJoined) return;

        const thread = await this.prisma.chatThread.findUnique({ where: { id: threadId } });
        if (!thread || !this.isAiFallbackEligible(thread.type)) return;

        const stillEmpty = (await this.livekit.participantCount(call.roomName)) <= 1;
        if (!stillEmpty) return;

        const [school, caller] = await Promise.all([
          thread.schoolId ? this.prisma.school.findUnique({ where: { id: thread.schoolId }, select: { name: true } }) : Promise.resolve(null),
          this.prisma.user.findUnique({ where: { id: call.startedById }, select: { fullName: true, phone: true } }),
        ]);

        const metadata = JSON.stringify({
          threadId,
          callId: call.id,
          roomName: call.roomName,
          schoolId: thread.schoolId,
          schoolName: school?.name ?? null,
          branchId: thread.branchId,
          threadTitle: thread.title,
          threadType: thread.type,
          callerName: caller?.fullName ?? null,
          callerPhone: caller?.phone ?? null,
        });

        await this.livekit.dispatchAgent(call.roomName, this.aiAgentName, metadata);

        await this.prisma.chatCall.update({ where: { id: call.id }, data: { aiJoined: true, aiDispatchedAt: new Date() } });

        const systemMessage = await this.prisma.chatMessage.create({
          data: { threadId, senderId: call.startedById, body: '🤖 No one answered - the AI assistant has joined the call.' },
          include: { sender: { select: PERSON_SELECT } },
        });
        this.chatGateway.broadcastMessage(threadId, systemMessage);
      } catch (err) {
        this.logger.error(`AI fallback dispatch failed for call ${callId}: ${(err as Error).message}`);
      }
    }, this.aiFallbackTimeoutMs);
  }

  // Milestone 10d - immediate, no-timeout dispatch (this is a deliberate
  // feature the call-starter opted into, not a fallback for an unanswered
  // call) - fires right when the call is created, best-effort (a dispatch
  // failure here shouldn't block the call itself starting).
  private async dispatchNotetaker(
    call: { id: string; roomName: string; startedById: string },
    threadId: string,
    thread: { schoolId: string | null; branchId: string | null; title: string | null; type: string },
  ) {
    try {
      const school = thread.schoolId ? await this.prisma.school.findUnique({ where: { id: thread.schoolId }, select: { name: true } }) : null;
      const metadata = JSON.stringify({
        threadId,
        callId: call.id,
        roomName: call.roomName,
        schoolId: thread.schoolId,
        schoolName: school?.name ?? null,
        branchId: thread.branchId,
        threadTitle: thread.title,
        threadType: thread.type,
      });
      await this.livekit.dispatchAgent(call.roomName, this.notetakerAgentName, metadata);
      await this.prisma.chatCall.update({ where: { id: call.id }, data: { notetakerJoined: true } });

      // Attributed to whoever started the call - same "no dedicated AI user
      // account" convention used everywhere else in Milestone 10.
      const systemMessage = await this.prisma.chatMessage.create({
        data: { threadId, senderId: call.startedById, body: '📝 AI notetaker has joined - a transcript and summary will be posted when the call ends.' },
        include: { sender: { select: PERSON_SELECT } },
      });
      this.chatGateway.broadcastMessage(threadId, systemMessage);
    } catch (err) {
      this.logger.error(`Notetaker dispatch failed for call ${call.id}: ${(err as Error).message}`);
    }
  }

  async getStatus(threadId: string, currentUser: ScopedUser & { userId: string }) {
    await this.chatService.assertMember(threadId, currentUser);
    return this.prisma.chatCall.findFirst({
      where: { threadId, status: 'ACTIVE' },
      include: { startedBy: { select: PERSON_SELECT } },
      orderBy: { startedAt: 'desc' },
    });
  }

  // Mints a LiveKit join token for this thread's call, starting one if none
  // is active yet. Publish permission depends on the thread's own
  // moderation rule (postingRestricted/BROADCAST) - a plain member of a
  // whole-school broadcast joins as a listen/watch-only participant, a
  // moderator or manager joins fully able to publish audio/video.
  async joinCall(threadId: string, currentUser: ScopedUser & { userId: string }, opts: { withNotetaker?: boolean } = {}) {
    const { thread, membership } = await this.chatService.assertMember(threadId, currentUser);
    const isManager = this.chatService.isManager(currentUser);
    const isModerator = membership.role === 'MODERATOR' || isManager;
    const user = await this.prisma.user.findUnique({ where: { id: currentUser.userId }, select: { fullName: true } });

    let call = await this.prisma.chatCall.findFirst({ where: { threadId, status: 'ACTIVE' } });

    if (!call) {
      if (thread.type === 'BROADCAST' && !isModerator) {
        throw new ForbiddenException('Only a moderator can start a call in this broadcast group - wait for it to begin.');
      }
      call = await this.prisma.chatCall.create({
        data: { threadId, roomName: this.roomNameFor(threadId), startedById: currentUser.userId },
      });

      const systemMessage = await this.prisma.chatMessage.create({
        data: { threadId, senderId: currentUser.userId, body: `📹 ${user?.fullName ?? 'Someone'} started a video call.` },
        include: { sender: { select: PERSON_SELECT } },
      });
      await this.prisma.chatThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });
      this.chatGateway.broadcastMessage(threadId, systemMessage);
      this.chatGateway.broadcastCallEvent(threadId, 'started');
      this.scheduleAiFallback(call.id, threadId);
      if (opts.withNotetaker) {
        void this.dispatchNotetaker(call, threadId, thread);
      }

      const otherMemberIds = (await this.prisma.chatThreadMember.findMany({ where: { threadId, userId: { not: currentUser.userId } }, select: { userId: true } })).map(
        (m) => m.userId,
      );
      if (otherMemberIds.length) {
        await this.prisma.notification.createMany({
          data: otherMemberIds.map((userId) => ({
            userId,
            type: 'SYSTEM' as const,
            title: `Video call started: ${thread.title ?? 'a conversation'}`,
            body: 'Join now from the Chat page.',
          })),
        });
      }
    }

    const canPublish = thread.type !== 'BROADCAST' || isModerator;
    const { token, url } = await this.livekit.mintToken({
      roomName: call.roomName,
      identity: currentUser.userId,
      name: user?.fullName ?? currentUser.userId,
      canPublish,
    });

    return { token, url, roomName: call.roomName, callId: call.id, canPublish };
  }

  async endCall(threadId: string, currentUser: ScopedUser & { userId: string }) {
    const { membership } = await this.chatService.assertMember(threadId, currentUser);
    const call = await this.prisma.chatCall.findFirst({ where: { threadId, status: 'ACTIVE' } });
    if (!call) throw new NotFoundException('No active call in this conversation');

    const isManager = this.chatService.isManager(currentUser);
    if (call.startedById !== currentUser.userId && membership.role !== 'MODERATOR' && !isManager) {
      throw new ForbiddenException('Only the person who started the call or a moderator can end it for everyone');
    }

    await this.prisma.chatCall.update({ where: { id: call.id }, data: { status: 'ENDED', endedAt: new Date() } });
    await this.livekit.endRoom(call.roomName);
    this.chatGateway.broadcastCallEvent(threadId, 'ended');
    return { success: true };
  }

  // --- Milestone 10c: voice-ai-agent (Python worker) facing methods ---
  // Called via AiFallbackController, which is protected by ServiceApiKeyGuard
  // (trusted peer service, not a logged-in user) rather than JwtAuthGuard -
  // the AI agent has no user account/JWT of its own, same trust model already
  // used for voice-agent-service <-> ERP calls (VOICE_AGENT_INTEGRATION_KEY).

  // Posts the AI's own reply/summary text into the thread as a normal chat
  // message, attributed to whoever started the call (there's no dedicated
  // "AI" user account - keeping this consistent with the "call started"
  // system message above rather than introducing a new concept).
  async postAiMessage(callId: string, body: string) {
    const call = await this.prisma.chatCall.findUnique({ where: { id: callId } });
    if (!call) throw new NotFoundException('Call not found');
    const message = await this.prisma.chatMessage.create({
      data: { threadId: call.threadId, senderId: call.startedById, body },
      include: { sender: { select: PERSON_SELECT } },
    });
    await this.prisma.chatThread.update({ where: { id: call.threadId }, data: { updatedAt: new Date() } });
    this.chatGateway.broadcastMessage(call.threadId, message);
    return message;
  }

  // Lets the agent hang up once it's finished (answered the question, logged
  // a callback request, or the caller left) - same ENDED/endRoom/broadcast
  // sequence as a human ending the call, just not gated by membership/roles
  // since the caller here is the trusted worker, not a browser user.
  async endCallByAgent(callId: string, transcript?: string, summary?: string) {
    const call = await this.prisma.chatCall.findUnique({ where: { id: callId } });
    if (!call) throw new NotFoundException('Call not found');
    if (call.status !== 'ACTIVE') return { success: true };

    await this.prisma.chatCall.update({
      where: { id: call.id },
      data: { status: 'ENDED', endedAt: new Date(), transcript, summary },
    });
    await this.livekit.endRoom(call.roomName);
    this.chatGateway.broadcastCallEvent(call.threadId, 'ended');
    return { success: true };
  }

  // Milestone 10d - called once the notetaker has finished generating
  // minutes (whenever the meeting winds down - it detects this itself via
  // the room emptying out, see voice-ai-agent's notetaker entrypoint).
  // Deliberately does NOT touch call status/end the room - a human may still
  // be wrapping up, or may have already ended the call by the time this
  // lands (the notetaker's summarization takes a few seconds after everyone
  // leaves) - this only ever records what was said, never controls the call.
  async saveNotetakerOutput(callId: string, transcript: string, summary: string) {
    const call = await this.prisma.chatCall.findUnique({ where: { id: callId } });
    if (!call) throw new NotFoundException('Call not found');

    await this.prisma.chatCall.update({ where: { id: call.id }, data: { transcript, summary } });

    const message = await this.prisma.chatMessage.create({
      data: { threadId: call.threadId, senderId: call.startedById, body: `📝 Meeting notes:\n${summary}` },
      include: { sender: { select: PERSON_SELECT } },
    });
    await this.prisma.chatThread.update({ where: { id: call.threadId }, data: { updatedAt: new Date() } });
    this.chatGateway.broadcastMessage(call.threadId, message);
    return { success: true };
  }
}
