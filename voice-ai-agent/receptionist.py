"""
Milestone 10c - AI fallback call-answering (in-app LiveKit calls).

Explicitly dispatched (NOT auto-joined to every room) by the main ERP backend
(school-management-system/backend, src/modules/chat/chat-call.service.ts ->
scheduleAiFallback()) whenever someone starts a video call inside the Chat
feature and nobody else answers within AI_FALLBACK_TIMEOUT_SECONDS. It joins
that specific LiveKit room, listens, talks back using Claude, and can:

  - Answer using its own 9-duty toolbox (same backend the phone/Vapi
    assistant already uses - see ../voice-agent-service) whenever the
    question is within its jurisdiction.
  - Fall back to "request_callback" (logs what was asked, promises a human
    callback) whenever the question is outside that jurisdiction or outside
    whatever it actually knows - it never guesses or invents school policy.
  - Hang up when done, posting a short summary back into the chat thread so
    humans who open the conversation later see what happened.

Voice pipeline: Deepgram (STT + TTS, direct plugin/own API key - see
CLAUDE_PROJECT_MEMORY.md for the cost/latency reasoning) + Claude (LLM,
via the official Anthropic LiveKit plugin) + Silero (VAD).
"""

from __future__ import annotations

import json
import logging
import os

from livekit import agents
from livekit.agents import Agent, AgentSession, RunContext, function_tool
from livekit.agents.llm import ToolError
from livekit.plugins import anthropic, deepgram, silero

from clients import erp_client, voice_agent_client
from server import server

logger = logging.getLogger("voice-ai-agent.receptionist")

RECEPTIONIST_AGENT_NAME = os.environ.get("LIVEKIT_AI_AGENT_NAME", "school-ai-receptionist")

# Note: the allowed enum values for category/absence_type/requested_with/
# event_type are spelled out directly in each tool's docstring below (plain
# strings, not f-strings) rather than interpolated from constants here -
# @function_tool reads a function's __doc__ to build the tool description
# sent to the LLM, and an f-string used as the first statement of a function
# is NOT stored as __doc__ (Python only does that for plain string literals),
# so interpolating a constant into what looks like a docstring would have
# silently produced an empty description. The voice-agent-service HTTP call
# still rejects anything invalid regardless, surfaced to the LLM as a
# ToolError so it can correct itself either way.


class ReceptionistAgent(Agent):
    """One instance per dispatched call. Holds whatever the call learns
    (verified student, admission-lead id) so later tool calls in the same
    conversation can reuse it instead of re-asking the caller."""

    def __init__(self, meta: dict) -> None:
        self.meta = meta
        self.call_id: str = meta["callId"]
        self.school_id: str | None = meta.get("schoolId")
        self.branch_id: str | None = meta.get("branchId")
        self.caller_name: str | None = meta.get("callerName")
        self.caller_phone: str | None = meta.get("callerPhone")

        # Filled in by verify_student() once called - later duty tools reuse
        # these instead of re-verifying, per the caller-verification-flow.md
        # rules the phone assistant already follows.
        self.erp_student_id: str | None = None
        self.admission_no: str | None = None
        self.verification_status: str = "UNVERIFIED"
        self.student_name: str | None = None
        self.class_section: str | None = None
        self.last_admission_lead_id: str | None = None

        school_name = meta.get("schoolName") or "the school"
        caller_line = f"You are speaking with {self.caller_name}. " if self.caller_name else ""

        super().__init__(
            instructions=f"""You are the AI front-desk assistant for {school_name}, standing in
            because nobody at the office answered this in-app call in time. {caller_line}

            Speak naturally in whatever language/style the caller uses (Roman Urdu, Urdu, or
            English are all common here) - mirror them, don't force English.

            You can genuinely help with these 9 things by using your tools: complaints, leave
            requests / absence notices, admission inquiries (and booking a campus tour), general
            feedback, requesting an appointment with the Principal/Director/Admin, today's
            schedule or timing changes, and upcoming academic calendar events (exams, holidays,
            PTMs, etc).

            Before creating any record tied to a specific child (a complaint, leave request, or
            absence notice), call verify_student with the admission number (preferred) or the
            caller's phone number, and follow what it returns - if it's a former/unverified/no
            match, still log the record but be honest with the caller about what you found rather
            than pretending it's a normal case.

            If the caller asks something outside these 9 things, or something you genuinely don't
            know (school-specific policy you weren't told, financial details, anything requiring
            judgment only a human should make) - do NOT guess or invent an answer. Call
            request_callback with exactly what they asked, tell them honestly you don't have that
            information but someone from the office will call them back, then call end_call.

            When the caller is done (question answered, callback promised, or they say goodbye),
            call end_call with a one-line summary of what happened on the call.

            Keep responses short and conversational - this is a live phone-style call, not a
            written chat.""",
        )

    # --- Duty 0: student verification -----------------------------------

    @function_tool()
    async def verify_student(self, context: RunContext, admission_no: str | None = None, phone: str | None = None) -> dict:
        """Verify a student before logging a complaint, leave request, or absence notice.
        Always try admission_no first if the caller can provide it - it's unambiguous.
        Fall back to phone only if they don't have the admission number handy.

        Args:
            admission_no: The student's admission number, if the caller has it.
            phone: The guardian's phone number, if no admission number is available.
        """
        try:
            result = await voice_agent_client.verify_student(admission_no, phone)
        except Exception as err:  # noqa: BLE001
            raise ToolError("Could not verify the student right now - proceed but tell the caller office staff will double check.") from err

        status = result.get("status")
        self.verification_status = status or "UNVERIFIED"
        if status in ("VERIFIED_ACTIVE", "VERIFIED_LEFT"):
            student = result.get("student", {})
            self.erp_student_id = student.get("studentId")
            self.admission_no = student.get("admissionNo")
            self.student_name = student.get("studentName")
            self.class_section = student.get("classSection")
        return result

    # --- Duty 1: complaints ----------------------------------------------

    @function_tool()
    async def log_complaint(
        self,
        context: RunContext,
        category: str,
        description: str,
        caller_name: str,
        caller_relation: str,
    ) -> str:
        """Log a complaint. Call verify_student first if it's about a specific child.

        Args:
            category: One of: ACADEMIC, DISCIPLINE, ADMIN, FEE, TRANSPORT
            description: What the caller is complaining about, in their own words.
            caller_name: The caller's name.
            caller_relation: Parent, Teacher, Student, or Administration.
        """
        context.disallow_interruptions()
        try:
            rec = await voice_agent_client.log_complaint({
                "erpSchoolId": self.school_id,
                "erpBranchId": self.branch_id,
                "erpStudentId": self.erp_student_id,
                "admissionNo": self.admission_no,
                "verificationStatus": self.verification_status,
                "studentName": self.student_name,
                "classSection": self.class_section,
                "category": category,
                "description": description,
                "callerName": caller_name,
                "callerRelation": caller_relation,
                "callerPhone": self.caller_phone or "unknown",
            })
        except Exception as err:  # noqa: BLE001
            raise ToolError("Could not log the complaint - apologize and offer a callback instead.") from err
        return f"Logged complaint #{rec.get('complaintNo')}. Office staff will follow up."

    # --- Duty 2: leave / absence -------------------------------------------

    @function_tool()
    async def request_leave(
        self,
        context: RunContext,
        father_name: str,
        from_date: str,
        to_date: str,
        reason: str,
    ) -> str:
        """Request leave for the verified student. Call verify_student first.

        Args:
            father_name: The student's father's name.
            from_date: First day of leave, ISO date (YYYY-MM-DD).
            to_date: Last day of leave, ISO date (YYYY-MM-DD).
            reason: Why the student needs leave.
        """
        context.disallow_interruptions()
        if not self.student_name:
            raise ToolError("Student not verified yet - call verify_student first and ask the caller for the admission number.")
        try:
            await voice_agent_client.create_leave_request({
                "erpSchoolId": self.school_id,
                "erpBranchId": self.branch_id,
                "erpStudentId": self.erp_student_id,
                "admissionNo": self.admission_no,
                "verificationStatus": self.verification_status,
                "studentName": self.student_name,
                "fatherName": father_name,
                "classSection": self.class_section,
                "fromDate": from_date,
                "toDate": to_date,
                "reason": reason,
                "callerPhone": self.caller_phone or "unknown",
            })
        except Exception as err:  # noqa: BLE001
            raise ToolError("Could not log the leave request - apologize and offer a callback instead.") from err
        return "Leave request logged - it's pending approval from the office."

    @function_tool()
    async def report_absence(self, context: RunContext, absence_type: str, date: str, reason_given: str | None = None) -> str:
        """Report a student's absence or late arrival. Call verify_student first.

        Args:
            absence_type: One of: LATE_ARRIVAL, FULL_DAY_ABSENCE
            date: The date of the absence, ISO date (YYYY-MM-DD).
            reason_given: The reason, if the caller gave one.
        """
        context.disallow_interruptions()
        if not self.student_name:
            raise ToolError("Student not verified yet - call verify_student first.")
        try:
            await voice_agent_client.log_absence_notice({
                "erpSchoolId": self.school_id,
                "erpStudentId": self.erp_student_id,
                "admissionNo": self.admission_no,
                "verificationStatus": self.verification_status,
                "studentName": self.student_name,
                "classSection": self.class_section,
                "date": date,
                "type": absence_type,
                "reasonGiven": reason_given,
                "parentReached": True,
            })
        except Exception as err:  # noqa: BLE001
            raise ToolError("Could not log the absence notice - apologize and offer a callback instead.") from err
        return "Absence notice logged - the class teacher will be informed."

    # --- Duty 7: admissions -------------------------------------------------

    @function_tool()
    async def log_admission_inquiry(
        self,
        context: RunContext,
        parent_name: str,
        phone: str,
        child_age: str | None = None,
        desired_class: str | None = None,
        notes: str | None = None,
    ) -> str:
        """Log a new-admission inquiry from a prospective parent (not a current student).

        Args:
            parent_name: The prospective parent's name.
            phone: Their phone number.
            child_age: The child's age, if given.
            desired_class: Which class they're interested in, if given.
            notes: Any other relevant detail.
        """
        context.disallow_interruptions()
        try:
            lead = await voice_agent_client.log_admission_lead({
                "erpSchoolId": self.school_id,
                "erpBranchId": self.branch_id,
                "parentName": parent_name,
                "phone": phone,
                "childAge": child_age,
                "desiredClass": desired_class,
                "notes": notes,
            })
        except Exception as err:  # noqa: BLE001
            raise ToolError("Could not log the admission inquiry - apologize and offer a callback instead.") from err
        self.last_admission_lead_id = lead.get("id")
        return "Admission inquiry logged. Would they like to book a campus tour?"

    @function_tool()
    async def book_campus_tour(self, context: RunContext, tour_date_time: str) -> str:
        """Book a campus tour for the admission lead just logged with log_admission_inquiry.

        Args:
            tour_date_time: Requested tour date/time, ISO 8601.
        """
        context.disallow_interruptions()
        if not self.last_admission_lead_id:
            raise ToolError("No admission inquiry logged yet in this call - call log_admission_inquiry first.")
        try:
            await voice_agent_client.book_campus_tour(self.last_admission_lead_id, tour_date_time)
        except Exception as err:  # noqa: BLE001
            raise ToolError("Could not book the tour - apologize and offer a callback instead.") from err
        return "Campus tour requested - office staff will confirm the exact time."

    # --- Duty 6: feedback -----------------------------------------------------

    @function_tool()
    async def log_feedback(self, context: RunContext, comment: str, rating: int | None = None) -> str:
        """Log general feedback that isn't a complaint about a specific issue.

        Args:
            comment: The feedback itself.
            rating: 1-5 if the caller gives one, otherwise omit.
        """
        try:
            await voice_agent_client.log_feedback({
                "erpSchoolId": self.school_id,
                "erpStudentId": self.erp_student_id,
                "callerName": self.caller_name,
                "callerPhone": self.caller_phone,
                "source": "INBOUND",
                "rating": rating,
                "comment": comment,
            })
        except Exception as err:  # noqa: BLE001
            raise ToolError("Could not log the feedback - thank them anyway, it's not critical to retry.") from err
        return "Thank you, feedback recorded."

    # --- Duty 9: appointments --------------------------------------------------

    @function_tool()
    async def request_appointment(self, context: RunContext, requested_with: str, reason: str, caller_relation: str) -> str:
        """Request an appointment with school leadership.

        Args:
            requested_with: One of: PRINCIPAL, DIRECTOR, ADMIN
            reason: Why they want the appointment.
            caller_relation: Parent, Teacher, or Other.
        """
        context.disallow_interruptions()
        try:
            await voice_agent_client.create_appointment_request({
                "erpSchoolId": self.school_id,
                "callerName": self.caller_name or "Caller",
                "callerRelation": caller_relation,
                "callerPhone": self.caller_phone or "unknown",
                "reason": reason,
                "requestedWith": requested_with,
            })
        except Exception as err:  # noqa: BLE001
            raise ToolError("Could not log the appointment request - apologize and offer a callback instead.") from err
        return "Appointment request logged - they'll be contacted to confirm a time."

    # --- Duty 4/8: schedule & calendar (read-only) -----------------------------

    @function_tool()
    async def check_schedule(self, context: RunContext, date: str) -> dict | list:
        """Check for a holiday, half day, emergency closure, or timing change on a given date.

        Args:
            date: ISO date (YYYY-MM-DD) to check.
        """
        try:
            return await voice_agent_client.get_schedule_update(date)
        except Exception as err:  # noqa: BLE001
            raise ToolError("Could not check the schedule right now.") from err

    @function_tool()
    async def check_calendar(self, context: RunContext, event_type: str | None = None, date_from: str | None = None, date_to: str | None = None) -> dict | list:
        """Check upcoming academic calendar events (exams, holidays, PTMs, etc).

        Args:
            event_type: Optional filter, one of: EXAM, HOLIDAY, PTM, ANNUAL_FUNCTION, SPORTS_DAY, OTHER
            date_from: Optional ISO date range start.
            date_to: Optional ISO date range end.
        """
        try:
            return await voice_agent_client.get_academic_calendar(event_type, date_from, date_to)
        except Exception as err:  # noqa: BLE001
            raise ToolError("Could not check the calendar right now.") from err

    # --- Milestone 10c fallback -------------------------------------------------

    @function_tool()
    async def request_callback(self, context: RunContext, question: str, extra_context: str | None = None) -> str:
        """Use this whenever the caller's question is outside your 9 duties or outside what
        you actually know - never guess. Logs the question for a human callback.

        Args:
            question: What the caller actually asked, as close to verbatim as possible.
            extra_context: Any short additional context that would help office staff prepare.
        """
        try:
            await voice_agent_client.request_callback({
                "erpSchoolId": self.school_id,
                "erpBranchId": self.branch_id,
                "erpStudentId": self.erp_student_id,
                "admissionNo": self.admission_no,
                "verificationStatus": self.verification_status,
                "channel": "IN_APP_AI",
                "callerName": self.caller_name,
                "callerPhone": self.caller_phone,
                "question": question,
                "context": extra_context,
            })
        except Exception as err:  # noqa: BLE001
            raise ToolError("Could not log the callback request - tell them to try the office directly instead.") from err
        return "Callback request logged - someone from the office will get back to them."

    # --- Hang up -----------------------------------------------------------------

    @function_tool()
    async def end_call(self, context: RunContext, summary: str) -> None:
        """Call this once the conversation is over (question answered, callback promised, or
        the caller says goodbye) to end the call.

        Args:
            summary: One line describing what happened on this call, for the chat log.
        """
        try:
            await erp_client.post_message(self.call_id, f"🤖 {summary}")
        except Exception:  # noqa: BLE001
            logger.exception("Failed to post AI summary message to chat")
        try:
            await voice_agent_client.log_call_summary({
                "erpSchoolId": self.school_id,
                "callerPhone": self.caller_phone or "unknown",
                "callerName": self.caller_name,
                "erpStudentId": self.erp_student_id,
                "duty": "In-app LiveKit call (Milestone 10c)",
                "summary": summary,
            })
        except Exception:  # noqa: BLE001
            logger.exception("Failed to log call summary to voice-agent-service")
        try:
            await erp_client.end_call(self.call_id, summary=summary)
        except Exception:  # noqa: BLE001
            logger.exception("Failed to end call via ERP")


@server.rtc_session(agent_name=RECEPTIONIST_AGENT_NAME)
async def receptionist_entrypoint(ctx: agents.JobContext) -> None:
    try:
        meta = json.loads(ctx.job.metadata or "{}")
    except ValueError:
        logger.error("Dispatch metadata was not valid JSON: %r", ctx.job.metadata)
        meta = {}

    if "callId" not in meta:
        logger.error("Dispatch metadata missing callId - refusing to join without call context.")
        return

    agent = ReceptionistAgent(meta)

    session = AgentSession(
        stt=deepgram.STT(model="nova-3", language="en"),
        llm=anthropic.LLM(model="claude-sonnet-4-6"),
        tts=deepgram.TTS(model="aura-2-asteria-en"),
        vad=silero.VAD.load(),
    )

    await session.start(room=ctx.room, agent=agent)

    greeting_who = meta.get("schoolName") or "the school office"
    await session.generate_reply(
        instructions=(
            f"Greet the caller warmly, explain nobody at {greeting_who} could take the call "
            "right now so you're stepping in as the AI assistant, and ask how you can help. "
            "Keep it brief."
        )
    )
