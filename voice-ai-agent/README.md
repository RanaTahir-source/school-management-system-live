# Voice AI Agent (Milestones 10c + 10d)

A Python [LiveKit Agents](https://docs.livekit.io/agents/) worker process that serves **two**
explicit dispatch targets for the Chat feature's in-app video calls
(`school-management-system/backend` + `frontend`):

- **`receptionist.py`** (Milestone 10c) - answers a call when nobody at the office picks up in
  time. Reuses the same "brain's toolbox" the existing phone/Vapi assistant already has
  (`../voice-agent-service`) instead of duplicating any of that logic.
- **`notetaker.py`** (Milestone 10d) - an opt-in silent participant that transcribes a meeting
  (speaker-labeled) and posts AI-generated minutes back into the chat thread once it winds down.

Both register against the same shared `server.py` (`AgentServer`) and run as **one** Railway
service/process - `agent.py` is just the thin entrypoint that imports both modules (registering
their handlers) and hands the server to LiveKit's CLI runner.

## How it fits together

```
Parent starts a call in Chat (frontend)
        |
        v
backend/src/modules/chat/chat-call.service.ts  (joinCall)
        | starts a 45s timer (AI_FALLBACK_TIMEOUT_SECONDS)
        | nobody else joined the LiveKit room in time?
        v
backend calls LiveKit's Agent Dispatch API (livekit.service.ts dispatchAgent())
        | explicit dispatch -> this worker, with job metadata:
        |   { callId, threadId, roomName, schoolId, schoolName,
        |     branchId, threadTitle, threadType, callerName, callerPhone }
        v
voice-ai-agent (this folder) joins that ONE room
        | STT (Deepgram) -> LLM (Claude, via tools) -> TTS (Deepgram)
        | tools call ../voice-agent-service (complaints, leave, admissions,
        |   feedback, appointments, schedule/calendar, callback-requests)
        | and the ERP's narrow /chat/ai/* routes (post a message, end the call)
        v
Caller gets help (or a "someone will call you back" promise), AI hangs up,
a system message is posted into the chat thread so humans see what happened.
```

## Why a separate Python service

LiveKit's Agents framework is Python-first (the Node.js SDK exists but is less mature). Rather
than force this onto the NestJS/TypeScript stack the rest of the project uses, this is a small,
standalone service - same pattern already used for `../voice-agent-service` (also intentionally
separate, per the owner's decision to keep the AI voice assistant's own concerns out of the main
ERP codebase).

## Setup

1. Copy `.env.example` to `.env` and fill in real values (LiveKit Cloud keys are the same ones
   already set on `school-management-system/backend` in Railway - see
   `CLAUDE_PROJECT_MEMORY.md`).
2. `pip install -r requirements.txt` (or `uv sync` if you have `uv`).
3. Local dev: `python agent.py dev` - connects to LiveKit Cloud and waits for dispatch. Use
   LiveKit's [Agent Console](https://docs.livekit.io/agents/start/console/) to test it by hand
   before wiring up real calls.
4. Production: deploy this folder as its own Railway service (`Dockerfile` included), same as
   `voice-agent-service`. Once it's running and registered under `LIVEKIT_AI_AGENT_NAME`, set
   `AI_FALLBACK_ENABLED=true` on the **backend** service's environment variables - it defaults to
   `false` so nothing tries to dispatch an agent that doesn't exist yet.

## Environment variables the backend must also have set

| Variable | Where | Purpose |
|---|---|---|
| `AI_FALLBACK_ENABLED` | backend | `"true"` to turn Milestone 10c on at all (default off) |
| `AI_FALLBACK_TIMEOUT_SECONDS` | backend | How long to wait for a human before dispatching the receptionist (default 45) |
| `LIVEKIT_AI_AGENT_NAME` | backend AND this service | Must match exactly - the receptionist's dispatch name |
| `LIVEKIT_NOTETAKER_AGENT_NAME` | backend AND this service | Must match exactly - the notetaker's dispatch name |

Milestone 10d (notetaker) has no on/off switch on the backend - it only ever dispatches when a
user explicitly ticks "Enable AI notetaker" when starting a call (`withNotetaker: true` in the
`POST /chat/threads/:id/call/join` body), so there's no equivalent to `AI_FALLBACK_ENABLED` needed.

## Scope notes

- **Receptionist (10c)**: only dispatches into **DIRECT** (1:1) chat calls for now - see the
  `isAiFallbackEligible()` comment in `chat-call.service.ts`. Group/broadcast calls already have
  several people who might answer; widening this to those is a separate, not-yet-requested
  decision.
- **Notetaker (10d)**: works in any thread type, since it's opt-in per call rather than an
  automatic fallback.

## Not built yet / needs verification before production

- `notetaker.py` uses LiveKit's lower-level room/track/STT-streaming APIs (not the higher-level
  `AgentSession` used by `receptionist.py`), since a multi-participant silent transcriber doesn't
  fit the single-conversational-user shape `AgentSession` assumes. This is the least-verified code
  in the project - nothing here has been run (bash sandbox was unavailable all session) and
  LiveKit's API surface moves fast. Test it thoroughly via LiveKit's Agent Console with a real
  multi-person room before trusting it with real meetings.
- No automated tests yet for either agent - test manually via LiveKit's Agent Console first, then
  a real in-app call/meeting, before relying on this in production.
- Milestone 10e (real PSTN bridging) is separate and not started.
