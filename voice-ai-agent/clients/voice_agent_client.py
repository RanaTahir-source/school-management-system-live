"""
Thin async HTTP client for voice-agent-service (../voice-agent-service).

This is the SAME backend the phone/Vapi assistant already uses for its 9
duties (complaints, leave requests, absence notices, admission leads,
feedback, appointments, schedule updates, calendar events, call-log memory)
plus the newer callback-requests duty (Milestone 10c fallback). The in-app
LiveKit agent reuses it wholesale rather than duplicating any of that logic -
one shared "brain's toolbox" behind two different "ears/mouths" (Vapi/PSTN
vs. LiveKit in-app calls).

Auth: single shared secret via the X-API-Key header (VOICE_AGENT_SERVICE_API_KEY),
matching voice-agent-service/src/common/guards/api-key.guard.ts exactly.
"""

from __future__ import annotations

import os
from typing import Any

from livekit.agents import utils

VOICE_AGENT_SERVICE_URL = os.environ.get("VOICE_AGENT_SERVICE_URL", "http://localhost:3001")
VOICE_AGENT_SERVICE_API_KEY = os.environ.get("VOICE_AGENT_SERVICE_API_KEY", "")


def _headers() -> dict[str, str]:
    return {"X-API-Key": VOICE_AGENT_SERVICE_API_KEY, "Content-Type": "application/json"}


async def _request(method: str, path: str, *, json: dict[str, Any] | None = None, params: dict[str, Any] | None = None) -> Any:
    session = utils.http_context.http_session()
    url = f"{VOICE_AGENT_SERVICE_URL}{path}"
    async with session.request(method, url, json=json, params=params, headers=_headers()) as resp:
        resp.raise_for_status()
        if resp.content_type == "application/json":
            return await resp.json()
        return await resp.text()


# --- verify_student ---------------------------------------------------------

async def verify_student(admission_no: str | None = None, phone: str | None = None) -> dict[str, Any]:
    params = {}
    if admission_no:
        params["admissionNo"] = admission_no
    if phone:
        params["phone"] = phone
    return await _request("GET", "/verify-student", params=params)


# --- Duty 1: Complaints ------------------------------------------------------

async def log_complaint(data: dict[str, Any]) -> dict[str, Any]:
    return await _request("POST", "/complaints", json=data)


# --- Duty 2: Leave requests / absence notices -------------------------------

async def create_leave_request(data: dict[str, Any]) -> dict[str, Any]:
    return await _request("POST", "/leave-requests", json=data)


async def log_absence_notice(data: dict[str, Any]) -> dict[str, Any]:
    return await _request("POST", "/absence-notices", json=data)


# --- Duty 7: Admission leads -------------------------------------------------

async def log_admission_lead(data: dict[str, Any]) -> dict[str, Any]:
    return await _request("POST", "/admission-leads", json=data)


async def book_campus_tour(lead_id: str, tour_date_time: str) -> dict[str, Any]:
    return await _request("PATCH", f"/admission-leads/{lead_id}/book-tour", json={"tourDateTime": tour_date_time})


# --- Duty 6: Feedback ---------------------------------------------------------

async def log_feedback(data: dict[str, Any]) -> dict[str, Any]:
    return await _request("POST", "/feedback", json=data)


# --- Duty 9: Appointments -----------------------------------------------------

async def create_appointment_request(data: dict[str, Any]) -> dict[str, Any]:
    return await _request("POST", "/appointments", json=data)


# --- Duty 4/8: Schedule updates & calendar events -----------------------------

async def get_schedule_update(date: str) -> Any:
    return await _request("GET", "/schedule-updates", params={"date": date})


async def get_academic_calendar(event_type: str | None = None, date_from: str | None = None, date_to: str | None = None) -> Any:
    params: dict[str, Any] = {}
    if event_type:
        params["type"] = event_type
    if date_from:
        params["from"] = date_from
    if date_to:
        params["to"] = date_to
    return await _request("GET", "/calendar-events", params=params)


# --- Call memory --------------------------------------------------------------

async def get_caller_history(caller_phone: str, limit: int = 5) -> Any:
    return await _request("GET", "/call-logs", params={"callerPhone": caller_phone, "limit": limit})


async def log_call_summary(data: dict[str, Any]) -> dict[str, Any]:
    return await _request("POST", "/call-logs", json=data)


# --- Milestone 10c fallback: callback requests --------------------------------

async def request_callback(data: dict[str, Any]) -> dict[str, Any]:
    return await _request("POST", "/callback-requests", json=data)
