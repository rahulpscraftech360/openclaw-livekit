import os

from dotenv import load_dotenv
from livekit.agents import AgentSession, JobContext, JobProcess, WorkerOptions, cli
from livekit.agents.voice import Agent
from livekit.plugins import deepgram, openai, silero

from plugins.edge_tts_plugin import TTS as EdgeTTS

load_dotenv(".env.local")


def prewarm(proc: JobProcess) -> None:
    proc.userdata["vad"] = silero.VAD.load()


async def entrypoint(ctx: JobContext) -> None:
    await ctx.connect()

    session = AgentSession(
        stt=deepgram.STT(model="nova-3"),
        llm=openai.LLM(
            model=os.getenv("OPENCLAW_MODEL", "openclaw:voice"),
            base_url=os.getenv("OPENCLAW_BASE_URL", "http://localhost:3000/v1"),
            api_key="not-needed",
        ),
        tts=EdgeTTS(),
        vad=ctx.proc.userdata["vad"],
        turn_detection="vad",
    )

    await session.start(
        agent=Agent(instructions="You are a helpful personal assistant powered by OpenClaw. Be concise and friendly."),
        room=ctx.room,
    )


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, prewarm_fnc=prewarm))
