FROM python:3.12-slim

WORKDIR /app

# System deps some LiveKit plugins (audio processing) need to build/run.
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# "start" = production mode (see LiveKit Agents server startup modes).
# The worker registers under LIVEKIT_AI_AGENT_NAME and waits for explicit
# dispatch - it does not do anything until the ERP backend dispatches a job.
CMD ["python", "agent.py", "start"]
