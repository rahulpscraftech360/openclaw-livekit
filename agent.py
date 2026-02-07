import logging
import os

from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("openclaw-agent")
from livekit.agents import AgentSession, JobContext, JobProcess, WorkerOptions, cli
from livekit.agents.voice import Agent
from livekit.plugins import deepgram, openai, silero

from plugins.edge_tts_plugin import TTS as EdgeTTS

load_dotenv(".env.local")


def prewarm(proc: JobProcess) -> None:
    proc.userdata["vad"] = silero.VAD.load()


async def entrypoint(ctx: JobContext) -> None:
    logger.info(f"Connecting to room: {ctx.room.name}")
    await ctx.connect()
    logger.info(f"Successfully joined room: {ctx.room.name} (sid: {ctx.room.sid})")

    session = AgentSession(
        stt=deepgram.STT(model="nova-3"),
        llm=openai.LLM(
            model=os.getenv("OPENCLAW_MODEL", "openclaw:Phoenix"),
            base_url=os.getenv("OPENCLAW_BASE_URL", "http://localhost:18789/v1"),
            api_key=os.getenv("OPENCLAW_API_KEY", "41a2e5fb5f149a366aa9671d3d89c67d075425bba394a3bc"),
            timeout=120.0,  # Increase timeout for OpenClaw (uses external LLM)
        ),
        tts=EdgeTTS(),
        vad=ctx.proc.userdata["vad"],
        turn_detection="vad",
    )

    logger.info("Starting agent session...")
    await session.start(
        agent=Agent(instructions="You are a helpful personal assistant powered by OpenClaw. Be concise and friendly."),
        room=ctx.room,
    )
    logger.info("Agent session started successfully")


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, prewarm_fnc=prewarm))
