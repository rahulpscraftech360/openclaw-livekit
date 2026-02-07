# OpenClaw Voice Agent

A voice-based personal assistant that lets you talk to your OpenClaw AI agent through a browser. Speak, listen, and get audio responses — powered by LiveKit, Deepgram, and Edge TTS.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BROWSER (Frontend)                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  index.html + app.js + style.css                                    │    │
│  │  • Mic capture via WebRTC                                           │    │
│  │  • Audio playback                                                   │    │
│  │  • LiveKit JS SDK (livekit-client)                                  │    │
│  │  • Transcript display                                               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ WebRTC (audio streams)
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LIVEKIT SERVER (port 7880)                          │
│  • WebRTC SFU (Selective Forwarding Unit)                                   │
│  • Room management                                                          │
│  • Audio/video routing                                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Agent connection
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LIVEKIT AGENT (Python)                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Deepgram    │  │  Silero VAD  │  │  OpenClaw    │  │  Edge TTS    │    │
│  │  STT         │  │  (Voice      │  │  LLM         │  │  (Text to    │    │
│  │  (Speech to  │  │  Activity    │  │  (Chat       │  │  Speech)     │    │
│  │  Text)       │  │  Detection)  │  │  Completions)│  │              │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│         │                  │                │                  │            │
│         ▼                  ▼                ▼                  ▼            │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      AgentSession Pipeline                          │    │
│  │  Audio In → STT → VAD → LLM → TTS → Audio Out                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTP API
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      OPENCLAW GATEWAY (port 18789)                          │
│  • /v1/chat/completions endpoint                                            │
│  • Agent orchestration                                                      │
│  • Memory & context management                                              │
│  • External LLM routing (Claude, GPT, etc.)                                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                      TOKEN SERVER (port 8081)                               │
│  • Generates LiveKit room tokens                                            │
│  • CORS-enabled for browser access                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

1. **User speaks** → Browser captures audio via WebRTC
2. **Audio streams** → LiveKit Server routes to Agent
3. **STT (Deepgram)** → Converts speech to text
4. **VAD (Silero)** → Detects when user stops speaking
5. **LLM (OpenClaw)** → Processes text, generates response
6. **TTS (Edge TTS)** → Converts response to audio
7. **Audio streams** → Back through LiveKit to browser
8. **User hears** → Response plays in browser

## Prerequisites

- **Python 3.11+** with uv or pip
- **LiveKit Server** running on port 7880
- **OpenClaw** installed and running on port 18789
- **Deepgram API key** (free tier: 200 hours)
- **Modern browser** (Chrome/Edge recommended)

## Installation

### 1. Clone and Install Dependencies

```bash
cd D:\openclaw
pip install -e .
```

Or install directly:

```bash
pip install livekit-agents livekit-plugins-silero livekit-plugins-openai \
    livekit-plugins-deepgram edge-tts python-dotenv pydub aiohttp
```

### 2. Configure Environment

Create `.env.local` in the project root:

```env
# LiveKit Server
LIVEKIT_URL=ws://localhost:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret

# Deepgram (Speech-to-Text)
DEEPGRAM_API_KEY=your_deepgram_api_key

# OpenClaw Gateway
OPENCLAW_BASE_URL=http://localhost:18789/v1
OPENCLAW_MODEL=openclaw:Phoenix
OPENCLAW_API_KEY=your_openclaw_gateway_token

# Edge TTS (Text-to-Speech)
EDGE_TTS_VOICE=en-US-AriaNeural
```

### 3. Enable OpenClaw Chat Completions

Add to `~/.openclaw/openclaw.json` under `gateway`:

```json
{
  "gateway": {
    "http": {
      "endpoints": {
        "chatCompletions": {
          "enabled": true
        }
      }
    }
  }
}
```

Then restart OpenClaw:

```bash
openclaw gateway restart
```

## Running the Project

You need **4 terminals** running simultaneously:

### Terminal 1: LiveKit Server

```bash
livekit-server --dev
```

### Terminal 2: Token Server

```bash
cd D:\openclaw
python token_server.py
```

Output:
```
Token server running on http://localhost:8081/token
LiveKit URL: ws://localhost:7880
Room: openclaw-voice
```

### Terminal 3: Voice Agent

```bash
cd D:\openclaw
python agent.py connect --room openclaw-voice
```

Output:
```
INFO:openclaw-agent:Connecting to room: openclaw-voice
INFO:openclaw-agent:Successfully joined room: openclaw-voice (sid: RM_xxx)
INFO:openclaw-agent:Starting agent session...
INFO:openclaw-agent:Agent session started successfully
```

### Terminal 4: Frontend Server

```bash
cd D:\openclaw\frontend
python -m http.server 8000
```

### Open Browser

Navigate to: **http://localhost:8000**

1. Click the mic button to start listening
2. Speak your message
3. Wait for the agent to respond with audio

## Project Structure

```
D:\openclaw\
├── agent.py                    # Main LiveKit voice agent
├── token_server.py             # LiveKit token generation server
├── pyproject.toml              # Python dependencies
├── .env.local                  # Environment configuration (gitignored)
├── .gitignore
├── VOICE_AGENT.md              # This documentation
├── prd.md                      # Product Requirements Document
│
├── plugins/
│   ├── __init__.py
│   └── edge_tts_plugin.py      # Custom Edge TTS adapter for LiveKit
│
└── frontend/
    ├── index.html              # Web UI
    ├── app.js                  # LiveKit JS client logic
    └── style.css               # Styling
```

## Component Details

### agent.py

The main voice agent that:
- Connects to LiveKit room via `connect` command
- Processes speech via Deepgram STT (Nova-3 model)
- Detects turn completion via Silero VAD
- Sends transcripts to OpenClaw for LLM response
- Synthesizes audio response via Edge TTS
- Has 120 second timeout for slow LLM responses

### token_server.py

Simple aiohttp server that:
- Listens on port 8081
- Generates LiveKit room tokens for browser clients
- Enables CORS for cross-origin requests
- Returns token + LiveKit URL as JSON

### plugins/edge_tts_plugin.py

Custom TTS plugin that:
- Wraps Microsoft Edge TTS (free, no API key needed)
- Converts MP3 output to PCM for LiveKit
- Supports configurable voice selection
- Streams audio sentence-by-sentence for low latency

### frontend/

Static web app that:
- Connects to LiveKit via WebRTC
- Captures microphone audio
- Plays agent audio responses
- Shows real-time transcripts
- Displays connection status

## Configuration Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `LIVEKIT_URL` | LiveKit server WebSocket URL | `ws://localhost:7880` |
| `LIVEKIT_API_KEY` | LiveKit API key | `devkey` |
| `LIVEKIT_API_SECRET` | LiveKit API secret | `secret` |
| `DEEPGRAM_API_KEY` | Deepgram API key for STT | Required |
| `OPENCLAW_BASE_URL` | OpenClaw gateway URL | `http://localhost:18789/v1` |
| `OPENCLAW_MODEL` | OpenClaw agent/model ID | `openclaw:Phoenix` |
| `OPENCLAW_API_KEY` | OpenClaw gateway auth token | Required |
| `EDGE_TTS_VOICE` | Microsoft Edge TTS voice | `en-US-AriaNeural` |

## Troubleshooting

### Agent not joining room

Use `connect` mode instead of `dev`:
```bash
python agent.py connect --room openclaw-voice
```

### LLM timeout errors

The agent has a 120-second timeout configured. If still timing out:
1. Check OpenClaw gateway is running: `openclaw gateway status`
2. Test the endpoint manually with curl
3. Check your LLM model is responding

### "Method Not Allowed" from OpenClaw

Enable chat completions in OpenClaw config (`~/.openclaw/openclaw.json`):
```json
{
  "gateway": {
    "http": {
      "endpoints": {
        "chatCompletions": { "enabled": true }
      }
    }
  }
}
```

Then restart: `openclaw gateway restart`

### No audio from agent

1. Check browser console (F12) for errors
2. Ensure Edge TTS is working: `edge-tts --text "hello" --write-media test.mp3`
3. Verify agent logs show TTS synthesis
4. Check browser audio permissions

### Frontend can't connect

1. Ensure token server is running on port 8081
2. Check browser console for CORS errors
3. Verify LiveKit server is running on port 7880

### Connection refused errors

Check all services are running:
```bash
# LiveKit
curl http://localhost:7880

# Token server
curl http://localhost:8081/token

# OpenClaw
curl http://localhost:18789/v1/chat/completions
```

## Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Voice Agent | Python + LiveKit Agents 1.4 | Audio pipeline orchestration |
| STT | Deepgram Nova-3 | Speech-to-text (cloud) |
| VAD | Silero | Voice activity detection (local) |
| LLM | OpenClaw Gateway | AI response generation |
| TTS | Microsoft Edge TTS | Text-to-speech (free, cloud) |
| WebRTC | LiveKit | Real-time audio streaming |
| Frontend | Vanilla JS + LiveKit SDK | Browser interface |
| Token Server | Python aiohttp | LiveKit authentication |

## Quick Start Checklist

- [ ] Python 3.11+ installed
- [ ] Dependencies installed (`pip install -e .`)
- [ ] LiveKit server running (`livekit-server --dev`)
- [ ] OpenClaw running with chatCompletions enabled
- [ ] Deepgram API key configured
- [ ] `.env.local` file created
- [ ] Token server running (`python token_server.py`)
- [ ] Agent running (`python agent.py connect --room openclaw-voice`)
- [ ] Frontend served (`python -m http.server 8000`)
- [ ] Browser open at http://localhost:8000
