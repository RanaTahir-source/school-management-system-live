"""
Thin async HTTP client for the main ERP's Milestone 10c "AI fallback" routes
(school-management-system/backend, src/modules/chat/ai-fallback.controller.ts).

These are the only two things the in-app LiveKit agent needs from the ERP
itself (everything else - complaints, leave, admissions, etc. - goes through
voice-agent-service, see voice_agent_client.py):

  1. Post its spoken replies back into the ChatThread as a readable message.
  2. Hang up (end the ChatCall) when it's done.

Auth: reuses the SAME shared secret already used for voice-agent-service <->
ERP student verification (VOICE_AGENT_INTEGRATION_KEY / ERP_INTEGRATION_KEY),
since this is the same trust boundary - a backend service we run, not a
person with a JWT.
"""

from __future__ import annotations

import os
from typing import Any

from livekit.agents import utils

ERP_BASE_URL = os.environ.get("ERP_BASE_URL", "http://localhost:3000")
ERP_INTEGRATION_KEY = os.environ.get("ERP_INTEGRATION_KEY", "")


def _headers() -> dict[str, str]:
    return {"X-API-Key": ERP_INTEGRATION_KEY, "Content-Type": "application/json"}


async def _request(method: str, path: str, *, json: dict[str, Any] | None = None) -> Any:
    session = utils.http_context.http_session()
    url = f"{ERP_BASE_URL}{path}"
    async with session.request(method, url, json=json, headers=_headers()) as resp:
        resp.raise_for_status()
        if resp.content_type == "application/json":
            return await resp.json()
        return await resp.text()


async def post_message(call_id: str, body: str) -> Any:
    return await _request("POST", "/chat/ai/messages", json={"callId": call_id, "body": body})


async def end_call(call_id: str, transcript: str | None = None, summary: str | None = None) -> Any:
    payload: dict[str, Any] = {"callId": call_id}
    if transcript:
        payload["transcript"] = transcript
    if summary:
        payload["summary"] = summary
    return await _request("POST", "/chat/ai/end-call", json=payload)


# Milestone 10d - AI meeting notetaker. Saves the transcript + generated
# summary onto the ChatCall row and posts the summary into the thread as a
# normal chat message. Does NOT end the call - the notetaker only records
# what was said, it never controls the call.
async def finalize_notes(call_id: str, transcript: str, summary: str) -> Any:
    return await _request("POST", "/chat/ai/notetaker/finalize", json={"callId": call_id, "transcript": transcript, "summary": summary})
