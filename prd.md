# OpenClaw Voice Agent - Product Requirements Document

## Overview
A **voice-based personal assistant** that lets you talk to your OpenClaw AI agent through a browser. You speak, it listens, thinks (via OpenClaw), and responds with audio — all running locally on your machine with zero cloud dependency for the core stack.

**Why LiveKit?** It provides production-grade WebRTC infrastructure, VAD, turn detection, and a clean agent pipeline (STT → LLM → TTS) out of the box. By pointing LiveKit's OpenAI-compatible LLM plugin at OpenClaw's gateway, we get the best of both worlds.

**Why Edge TTS?** It's free (no API key), high quality Microsoft voices, and works without any account setup — perfect for a fully local/free personal assistant.

---

## Target Audience
Personal users who want a hands-free voice interface to their self-hosted OpenClaw AI agent. Users who value privacy (local LLM processing), cost-effectiveness (free TTS, free STT tier), and a simple browser-based UI.

## Core Features
1. **Voice Input** — Speak into browser mic, real-time STT via Deepgram Nova-3 with Silero VAD turn detection
2. **AI Processing** — Transcribed text routed to OpenClaw's `/v1/chat/completions` endpoint with full agent context
3. **Voice Output** — LLM response synthesized via Edge TTS, streamed back as audio through WebRTC
4. **Conversation Continuity** — Multi-turn conversations with persistent memory via OpenClaw
5. **Browser Web App** — Clean minimal UI with mic toggle, status indicators, and optional transcript

---

## Tech Stack
- **Frontend**: Vanilla HTML/JS/CSS with LiveKit JS SDK (via CDN)
- **Backend**: Python 3.11+ with LiveKit Agents framework
- **Database**: None (OpenClaw handles persistence)
- **Styling**: Custom CSS (minimal, clean design)
- **Authentication**: None (local-only deployment)
- **Hosting**: Local machine (Windows 10/11)
- **Package Manager**: uv (Python)

---

## Architecture

```
┌──────────────────┐
│  Browser Web App  │
│  (HTML + JS)      │
│  - Mic capture    │
│  - Audio playback │
│  - LiveKit SDK    │
└────────┬─────────┘
         │ WebRTC (audio)
         ▼
┌──────────────────────────────────────────────┐
│  LiveKit Server (local, port 7880)            │
│  - WebRTC SFU                                │
│  - Room management                           │
└────────┬─────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│  LiveKit Agent (Python)                       │
│                                              │
│  ┌────────────┐  ┌─────────────────────────┐ │
│  │ Deepgram   │  │ OpenClaw Gateway        │ │
│  │ STT        │  │ (localhost:3000/v1)     │ │
│  │ (Nova-3)   │──►│ OpenAI-compatible API  │ │
│  └────────────┘  │ → Agent brain + memory  │ │
│                   └─────────────────────────┘ │
│  ┌────────────┐  ┌─────────────────────────┐ │
│  │ Silero VAD │  │ Edge TTS                │ │
│  │ (local)    │  │ (custom LiveKit plugin) │ │
│  └────────────┘  │ Free, no API key        │ │
│                   └─────────────────────────┘ │
└──────────────────────────────────────────────┘
```

---

## Functional Requirements

### FR-1: Voice Input (User → Agent)
- User clicks a mic button in the browser to start talking
- Audio streams via WebRTC to the LiveKit agent
- Deepgram STT converts speech to text in real-time
- Silero VAD detects when the user stops speaking (turn detection)

### FR-2: AI Processing (Agent → OpenClaw)
- Transcribed text is sent to OpenClaw's `/v1/chat/completions` endpoint
- OpenClaw processes with full agent context (memory, tools, skills)
- Response streams back token-by-token (SSE streaming)

### FR-3: Voice Output (Agent → User)
- LLM response text is sent to Edge TTS for synthesis
- Audio streams back to the browser via WebRTC
- User hears the response in real-time (low latency sentence-by-sentence)

### FR-4: Conversation Continuity
- OpenClaw maintains persistent memory across sessions
- Chat context is preserved within a LiveKit room session
- User can have multi-turn conversations naturally

### FR-5: Browser Web App
- Clean, minimal UI with:
  - Mic on/off toggle button
  - Visual indicator when agent is listening / thinking / speaking
  - Text transcript of the conversation (optional, nice-to-have)
- Works in Chrome, Edge, Firefox (WebRTC support)
- Connects to local LiveKit server via LiveKit JS SDK

---

## Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| **Latency** (end-to-end) | < 2 seconds from user stops speaking to audio response starts |
| **Cost** | $0 for TTS (Edge TTS). Deepgram free tier (200 hrs). OpenClaw self-hosted. |
| **Privacy** | All LLM processing stays local (OpenClaw). Only Deepgram STT and Edge TTS make external calls. |
| **Platform** | Windows 10/11 (user's machine). Python 3.11+. |

---

## Technical Components

### Custom Edge TTS Plugin for LiveKit
**File:** `plugins/edge_tts_plugin.py`

- Extends `livekit.agents.tts.TTS` base class
- Implements `synthesize(text) -> ChunkedStream`
- Uses the `edge-tts` Python library internally
- Converts Edge TTS audio output (MP3) to PCM frames for LiveKit
- Configurable voice selection (default: `en-US-AriaNeural`)

### LiveKit Agent
**File:** `agent.py`

- Creates `AgentSession` with:
  - `stt`: Deepgram Nova-3
  - `llm`: `openai.LLM(base_url="http://localhost:3000/v1")` → OpenClaw
  - `tts`: Custom Edge TTS plugin
  - `vad`: Silero VAD (local)
- Handles room join, session lifecycle
- Configurable system instructions for personal assistant persona

### Browser Frontend
**Files:** `frontend/index.html` + `frontend/app.js` + `frontend/style.css`

- LiveKit JS SDK (`livekit-client`) for WebRTC connection
- Token generation via local token server
- UI states: idle → listening → thinking → speaking
- Mic toggle button
- Optional transcript display

### Token Server
**File:** `token_server.py`

- Simple aiohttp endpoint to generate LiveKit room tokens
- Required for the browser to join a LiveKit room
- Runs locally on port 8081, no auth needed

### Configuration
**File:** `.env.local`

```
LIVEKIT_URL=ws://localhost:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
DEEPGRAM_API_KEY=<your-deepgram-key>
OPENCLAW_BASE_URL=http://localhost:3000/v1
OPENCLAW_MODEL=openclaw:voice
EDGE_TTS_VOICE=en-US-AriaNeural
```

---

## Dependencies

**Python:**
| Package | Purpose | Version |
|---------|---------|---------|
| `livekit-agents` | Agent framework | ~1.3 |
| `livekit-plugins-silero` | VAD (local) | ~1.3 |
| `livekit-plugins-turn-detector` | Turn detection | ~1.3 |
| `livekit-plugins-openai` | OpenAI-compatible LLM (→ OpenClaw) | ~1.3 |
| `livekit-plugins-deepgram` | Deepgram STT | ~1.3 |
| `edge-tts` | Microsoft Edge TTS (free) | latest |
| `python-dotenv` | Env config | latest |
| `pydub` | MP3→PCM conversion for Edge TTS | latest |
| `aiohttp` | Async HTTP for token server | latest |

**Frontend:**
| Package | Purpose |
|---------|---------|
| `livekit-client` (JS via CDN) | Browser WebRTC SDK |

---

## Prerequisites (User Must Have)

1. **OpenClaw** installed and running with `chatCompletions` endpoint enabled
2. **Deepgram** free account + API key
3. **Python 3.11+** with `uv` package manager
4. **LiveKit Server** binary (downloaded, runs locally on port 7880)
5. **A modern browser** (Chrome/Edge recommended)

---

## Project Structure

```
D:\openclaw\
├── agent.py                    # Main LiveKit agent
├── token_server.py             # Token generation for browser
├── .env.local                  # API keys (gitignored)
├── pyproject.toml              # Python dependencies
├── plugins/
│   ├── __init__.py
│   └── edge_tts_plugin.py      # Custom Edge TTS adapter for LiveKit
├── frontend/
│   ├── index.html              # Web UI
│   ├── app.js                  # LiveKit JS client logic
│   └── style.css               # Styling
├── prd.md                      # This PRD
├── activity.md                 # Progress log
└── PROMPT.md                   # Agent instructions
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Edge TTS latency (network call to Microsoft) | Sentence-level streaming — start playing audio as soon as first sentence is ready |
| Edge TTS MP3→PCM conversion overhead | Use `pydub` for fast conversion; buffer appropriately |
| OpenClaw gateway not streaming properly | Test with `curl` first; ensure SSE streaming is enabled |
| LiveKit local server setup complexity | Provide exact download/run commands in README |
| Deepgram free tier limits (200 hrs) | More than enough for personal use; can swap to Whisper later |

---

## Task List

```json
[
  {
    "id": 1,
    "category": "setup",
    "description": "Initialize Python project with pyproject.toml and install dependencies",
    "steps": [
      "Create pyproject.toml with project name 'openclaw-voice-agent' and Python >=3.11 requirement",
      "Add all dependencies: livekit-agents, livekit-plugins-silero, livekit-plugins-turn-detector, livekit-plugins-openai, livekit-plugins-deepgram, edge-tts, python-dotenv, pydub, aiohttp",
      "Run 'uv sync' to install all dependencies and create the virtual environment",
      "Verify installation by running 'uv run python -c \"import livekit.agents; print(livekit.agents.__version__)\"'"
    ],
    "passes": true
  },
  {
    "id": 2,
    "category": "setup",
    "description": "Create .env.local configuration file and .gitignore",
    "steps": [
      "Create .env.local with LIVEKIT_URL=ws://localhost:7880, LIVEKIT_API_KEY=devkey, LIVEKIT_API_SECRET=secret",
      "Add DEEPGRAM_API_KEY=<your-deepgram-key> placeholder",
      "Add OPENCLAW_BASE_URL=http://localhost:3000/v1",
      "Add OPENCLAW_MODEL=openclaw:voice",
      "Add EDGE_TTS_VOICE=en-US-AriaNeural",
      "Create or update .gitignore to include .env.local, .env, __pycache__/, .venv/, *.pyc"
    ],
    "passes": true
  },
  {
    "id": 3,
    "category": "feature",
    "description": "Build custom Edge TTS plugin for LiveKit agents",
    "steps": [
      "Create plugins/ directory with plugins/__init__.py",
      "Create plugins/edge_tts_plugin.py that extends livekit.agents.tts.TTS base class",
      "Implement synthesize() method that takes text and returns a ChunkedStream of PCM audio frames",
      "Use the edge-tts Python library internally to generate MP3 audio",
      "Use pydub to convert MP3 bytes to raw PCM (16kHz, 16-bit, mono) for LiveKit",
      "Add configurable voice parameter (default: en-US-AriaNeural from env)",
      "Implement sentence-level streaming: split text into sentences, synthesize and yield each as audio frames for low latency"
    ],
    "passes": false
  },
  {
    "id": 4,
    "category": "feature",
    "description": "Build the main LiveKit agent with OpenClaw integration",
    "steps": [
      "Create agent.py at project root",
      "Load environment variables from .env.local using python-dotenv",
      "Configure Deepgram STT with Nova-3 model using DEEPGRAM_API_KEY from env",
      "Configure OpenAI-compatible LLM plugin pointing to OpenClaw gateway (OPENCLAW_BASE_URL from env)",
      "Configure custom Edge TTS plugin from plugins/edge_tts_plugin.py",
      "Configure Silero VAD for voice activity detection",
      "Create AgentSession wiring STT, LLM, TTS with VAD",
      "Add system instructions for personal assistant persona",
      "Implement entrypoint with room join and session start logic",
      "Test with 'uv run agent.py console' to verify text-based interaction works"
    ],
    "passes": false
  },
  {
    "id": 5,
    "category": "feature",
    "description": "Build the token server for LiveKit room access",
    "steps": [
      "Create token_server.py at project root",
      "Use aiohttp to create a simple HTTP server on port 8081",
      "Implement GET /token endpoint that generates a LiveKit access token",
      "Token should grant room join permission with a default room name and participant identity",
      "Use livekit-api library for token generation with LIVEKIT_API_KEY and LIVEKIT_API_SECRET from env",
      "Add CORS headers (Access-Control-Allow-Origin: *) for browser access",
      "Test by running 'uv run token_server.py' and curling http://localhost:8081/token"
    ],
    "passes": false
  },
  {
    "id": 6,
    "category": "feature",
    "description": "Build the browser frontend HTML structure",
    "steps": [
      "Create frontend/ directory",
      "Create frontend/index.html with semantic HTML5 structure",
      "Include LiveKit JS SDK via CDN (livekit-client)",
      "Add mic toggle button element (prominent, centered)",
      "Add status indicator area (idle / listening / thinking / speaking)",
      "Add optional transcript panel container",
      "Link to app.js and style.css"
    ],
    "passes": false
  },
  {
    "id": 7,
    "category": "feature",
    "description": "Implement frontend JavaScript with LiveKit client logic",
    "steps": [
      "Create frontend/app.js",
      "Implement token fetching from http://localhost:8081/token",
      "Connect to LiveKit server using Room from livekit-client SDK",
      "Handle room events: ParticipantConnected, TrackSubscribed, TrackUnsubscribed",
      "Implement mic toggle: publish/unpublish local audio track",
      "Handle incoming audio tracks from the agent (auto-play via attached audio element)",
      "Update UI state indicators based on agent data messages or track state",
      "Implement optional transcript display by listening for agent text events"
    ],
    "passes": false
  },
  {
    "id": 8,
    "category": "styling",
    "description": "Style the frontend with clean, minimal CSS",
    "steps": [
      "Create frontend/style.css",
      "Design a dark-themed, centered layout",
      "Style the mic button with clear on/off states (color change, icon change)",
      "Add animated status indicators (pulsing dot for listening, spinner for thinking, waveform for speaking)",
      "Style the transcript panel with auto-scroll",
      "Ensure responsive design for different browser window sizes",
      "Add smooth transitions between UI states"
    ],
    "passes": false
  },
  {
    "id": 9,
    "category": "integration",
    "description": "End-to-end integration test: speak and hear response",
    "steps": [
      "Verify OpenClaw is running on localhost:3000 with chatCompletions enabled",
      "Verify LiveKit Server is running on port 7880",
      "Start the token server: 'uv run token_server.py'",
      "Start the agent: 'uv run agent.py dev'",
      "Serve frontend via 'python -m http.server 8080 --directory frontend --bind 127.0.0.1'",
      "Open http://localhost:8080 in browser",
      "Click mic button, speak a test phrase",
      "Verify: speech is transcribed (check agent logs), OpenClaw responds, Edge TTS audio plays back",
      "Take a screenshot of the working UI for verification"
    ],
    "passes": false
  },
  {
    "id": 10,
    "category": "integration",
    "description": "Multi-turn conversation test and latency verification",
    "steps": [
      "With full stack running, have a 3+ turn conversation with the agent",
      "Verify context is maintained across turns (agent remembers what was said)",
      "Measure approximate end-to-end latency (from stop speaking to hearing response)",
      "Verify transcript display updates correctly for each turn",
      "Test mic toggle on/off works reliably",
      "Take a screenshot showing multi-turn transcript"
    ],
    "passes": false
  }
]
```

---

## Agent Instructions

1. Read `activity.md` first to understand current state
2. Find next task with `"passes": false`
3. Complete all steps for that task
4. Verify in browser using agent-browser
5. Update task to `"passes": true`
6. Log completion in `activity.md`
7. Repeat until all tasks pass

**Important:** Only modify the `passes` field. Do not remove or rewrite tasks.

---

## Completion Criteria
All tasks marked with `"passes": true`
