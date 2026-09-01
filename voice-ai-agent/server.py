"""
Single shared AgentServer instance for this worker process.

Both dispatch targets (the Milestone 10c fallback receptionist and the
Milestone 10d meeting notetaker) register against this SAME server via
@server.rtc_session(agent_name=...), so one running process/Railway service
can serve both - LiveKit routes each explicit dispatch to whichever
agent_name was requested. receptionist.py and notetaker.py each import
`server` from here and register themselves at import time; agent.py (the
actual entrypoint run by Docker/`python agent.py start`) imports both of
those modules purely for that registration side-effect, then hands `server`
to the CLI runner.
"""

from livekit.agents import AgentServer

server = AgentServer()
