"""
Main entrypoint for the voice-ai-agent worker process.

Registers BOTH dispatch targets against the single shared AgentServer
(server.py) by importing the two modules that each attach a
@server.rtc_session(agent_name=...) handler at import time:

  - receptionist.py  -> Milestone 10c: AI fallback call-answering
                        (dispatch name: LIVEKIT_AI_AGENT_NAME,
                        default "school-ai-receptionist")
  - notetaker.py     -> Milestone 10d: AI meeting notetaker
                        (dispatch name: LIVEKIT_NOTETAKER_AGENT_NAME,
                        default "school-ai-notetaker")

One running process/Railway service serves both - LiveKit Cloud routes each
explicit dispatch call to whichever agent_name the ERP backend requested.
"""

from __future__ import annotations

from dotenv import load_dotenv

load_dotenv(".env")

from livekit import agents  # noqa: E402

import notetaker  # noqa: E402,F401  (side effect: registers @server.rtc_session)
import receptionist  # noqa: E402,F401  (side effect: registers @server.rtc_session)
from server import server  # noqa: E402

if __name__ == "__main__":
    agents.cli.run_app(server)
