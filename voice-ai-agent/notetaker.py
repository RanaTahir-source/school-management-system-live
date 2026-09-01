"""
Milestone 10d - AI meeting notetaker (in-app LiveKit calls).

Unlike receptionist.py (a fallback nobody asked for), this is opt-in: whoever
starts a call ticks "Enable AI notetaker" in the Chat UI, and the ERP
dispatches this agent immediately (no timeout) alongside them - see
scheduleAiFallback()'s sibling, dispatchNotetaker(), in
school-management-system/backend/src/modules/chat/chat-call.service.ts.

This agent does NOT speak and does NOT use AgentSession's conversational
turn-taking loop at all - it silently subscribes to every remote
participant's audio track, runs a separate Deepgram STT stream per
participant so the transcript is speaker-labeled, and once the meeting winds
down (everyone else has left the room) asks Claude once, directly, to turn
the raw transcript into short meeting minutes. The result is saved back onto
the ChatCall row and posted into the chat thread as a normal message via
ERP_client.finalize_notes().

**This is the least-verified file in this milestone.** It uses LiveKit's
lower-level room/track/STT-streaming APIs (rtc.AudioStream, stt.stream(),
push_frame, SpeechEvent) rather than the higher-level AgentSession used in
receptionist.py, because AgentSession assumes a single conversational
"user" - a multi-participant silent transcriber doesn't fit that shape.
Bash sandbox was unavailable all session (nothing here has been run), and
LiveKit's API surface moves fast - test this against the current
https://docs.livekit.io/reference/python/livekit/rtc/ and
https://docs.livekit.io/agents/models/stt/ docs before relying on it in
production, ideally via LiveKit's Agent Console with a real multi-person
room first.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os

from anthropic import AsyncAnthropic
from livekit import agents, rtc
from livekit.agents import stt as stt_types
from livekit.plugins import deepgram

from clients import erp_client
from server import server

logger = logging.getLogger("voice-ai-agent.notetaker")

NOTETAKER_AGENT_NAME = os.environ.get("LIVEKIT_NOTETAKER_AGENT_NAME", "school-ai-notetaker")

SUMMARY_PROMPT = """You are turning a raw, speaker-labeled meeting transcript into short, useful
minutes for a school. Write in plain prose (no markdown headers/bullets), covering: who was on
the call, what was discussed, any decisions made, and any action items with who owns them. If the
transcript is too short or unclear to summarize meaningfully, say so plainly instead of inventing
content. Keep it under 200 words.

Transcript:
{transcript}"""


class ParticipantTranscriber:
    """Runs one Deepgram STT stream for one participant's audio track, appending
    every finalized line to the shared transcript list, tagged with their name."""

    def __init__(self, participant: rtc.RemoteParticipant, track: rtc.RemoteAudioTrack, transcript: list[str]):
        self.label = participant.name or participant.identity
        self.track = track
        self.transcript = transcript
        self._stt = deepgram.STT(model="nova-3", language="multi")
        self._task: asyncio.Task | None = None

    def start(self) -> None:
        self._task = asyncio.create_task(self._run())

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()

    async def _run(self) -> None:
        audio_stream = rtc.AudioStream(self.track)
        stt_stream = self._stt.stream()

        async def forward_audio() -> None:
            async for audio_event in audio_stream:
                stt_stream.push_frame(audio_event.frame)

        async def collect_transcripts() -> None:
            async for event in stt_stream:
                if event.type == stt_types.SpeechEventType.FINAL_TRANSCRIPT and event.alternatives:
                    text = event.alternatives[0].text.strip()
                    if text:
                        self.transcript.append(f"{self.label}: {text}")

        try:
            await asyncio.gather(forward_audio(), collect_transcripts())
        except asyncio.CancelledError:
            pass
        except Exception:  # noqa: BLE001
            logger.exception("Transcription stream failed for %s", self.label)
        finally:
            await stt_stream.aclose()


async def summarize(transcript_lines: list[str]) -> str:
    if not transcript_lines:
        return "The call ended with no audible conversation captured - nothing to summarize."

    client = AsyncAnthropic()  # reads ANTHROPIC_API_KEY from the environment
    transcript_text = "\n".join(transcript_lines)
    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=400,
        messages=[{"role": "user", "content": SUMMARY_PROMPT.format(transcript=transcript_text)}],
    )
    return "".join(block.text for block in response.content if getattr(block, "type", None) == "text").strip()


@server.rtc_session(agent_name=NOTETAKER_AGENT_NAME)
async def notetaker_entrypoint(ctx: agents.JobContext) -> None:
    try:
        meta = json.loads(ctx.job.metadata or "{}")
    except ValueError:
        logger.error("Dispatch metadata was not valid JSON: %r", ctx.job.metadata)
        meta = {}

    call_id = meta.get("callId")
    if not call_id:
        logger.error("Notetaker dispatch missing callId - refusing to join without call context.")
        return

    await ctx.connect(auto_subscribe=agents.AutoSubscribe.AUDIO_ONLY)

    transcript_lines: list[str] = []
    transcribers: dict[str, ParticipantTranscriber] = {}
    finalized = False

    async def finalize() -> None:
        nonlocal finalized
        if finalized:
            return
        finalized = True
        for t in transcribers.values():
            await t.stop()
        try:
            summary = await summarize(transcript_lines)
        except Exception:  # noqa: BLE001
            logger.exception("Failed to summarize transcript via Claude")
            summary = "Meeting notes could not be generated automatically this time."
        try:
            await erp_client.finalize_notes(call_id, "\n".join(transcript_lines), summary)
        except Exception:  # noqa: BLE001
            logger.exception("Failed to send finalized notes to the ERP")

    @ctx.room.on("track_subscribed")
    def on_track_subscribed(track: rtc.Track, _publication: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant) -> None:
        if track.kind != rtc.TrackKind.KIND_AUDIO:
            return
        transcriber = ParticipantTranscriber(participant, track, transcript_lines)
        transcribers[participant.sid] = transcriber
        transcriber.start()

    @ctx.room.on("participant_disconnected")
    def on_participant_disconnected(_participant: rtc.RemoteParticipant) -> None:
        # Everyone else has left - the notetaker is the only one left in the
        # room. Finalize shortly after, rather than instantly, in case
        # someone reconnects within a few seconds (flaky connection, not an
        # actual meeting end).
        if len(ctx.room.remote_participants) == 0:
            asyncio.create_task(_finalize_after_delay())

    async def _finalize_after_delay() -> None:
        await asyncio.sleep(5)
        if len(ctx.room.remote_participants) == 0:
            await finalize()

    # Safety net: if the job gets shut down for any other reason (LiveKit
    # cleaning up an idle room, worker restart, etc.) before the participant-
    # count check above fires, still attempt to save whatever was captured
    # rather than silently losing the transcript.
    ctx.add_shutdown_callback(finalize)
