const { Room, RoomEvent, Track } = LivekitClient;

const TOKEN_URL = "http://localhost:8081/token";

const micBtn = document.getElementById("mic-btn");
const micIcon = document.getElementById("mic-icon");
const micOffIcon = document.getElementById("mic-off-icon");
const statusEl = document.getElementById("status");
const statusText = document.getElementById("status-text");
const transcriptMessages = document.getElementById("transcript-messages");

let room = null;
let micEnabled = false;

function setStatus(state, text) {
    statusEl.className = "status " + state;
    statusText.textContent = text;
}

function addTranscript(role, text) {
    const msg = document.createElement("div");
    msg.className = "message " + role;
    msg.innerHTML = "<strong>" + (role === "user" ? "You" : "Agent") + ":</strong> " + escapeHtml(text);
    transcriptMessages.appendChild(msg);
    transcriptMessages.scrollTop = transcriptMessages.scrollHeight;
}

function updateTranscript(segmentId, role, text) {
    let existing = document.querySelector('[data-segment="' + segmentId + '"]');
    if (existing) {
        existing.innerHTML = "<strong>" + (role === "user" ? "You" : "Agent") + ":</strong> " + escapeHtml(text);
    } else {
        const msg = document.createElement("div");
        msg.className = "message " + role;
        msg.dataset.segment = segmentId;
        msg.innerHTML = "<strong>" + (role === "user" ? "You" : "Agent") + ":</strong> " + escapeHtml(text);
        transcriptMessages.appendChild(msg);
    }
    transcriptMessages.scrollTop = transcriptMessages.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

async function connect() {
    try {
        setStatus("connecting", "Connecting...");
        console.log("[OpenClaw] Fetching token from:", TOKEN_URL);
        const resp = await fetch(TOKEN_URL);
        if (!resp.ok) {
            throw new Error(`Token fetch failed: ${resp.status} ${resp.statusText}`);
        }
        const data = await resp.json();
        console.log("[OpenClaw] Token received, LiveKit URL:", data.url);

        room = new Room();
        console.log("[OpenClaw] Room instance created");

        room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
            console.log("[OpenClaw] Track subscribed:", track.kind, "from:", participant.identity);
            if (track.kind === Track.Kind.Audio) {
                console.log("[OpenClaw] Attaching audio track from agent");
                const el = track.attach();
                document.body.appendChild(el);
            }
        });

        room.on(RoomEvent.TrackUnsubscribed, (track) => {
            console.log("[OpenClaw] Track unsubscribed:", track.kind);
            track.detach().forEach((el) => el.remove());
        });

        room.on(RoomEvent.ParticipantConnected, (participant) => {
            console.log("[OpenClaw] Participant connected:", participant.identity);
        });

        room.on(RoomEvent.ParticipantDisconnected, (participant) => {
            console.log("[OpenClaw] Participant disconnected:", participant.identity);
        });

        room.on(RoomEvent.Disconnected, (reason) => {
            console.log("[OpenClaw] Disconnected from room. Reason:", reason);
            setStatus("idle", "Disconnected");
            micEnabled = false;
            updateMicUI();
        });

        room.on(RoomEvent.Reconnecting, () => {
            console.log("[OpenClaw] Reconnecting to room...");
            setStatus("connecting", "Reconnecting...");
        });

        room.on(RoomEvent.Reconnected, () => {
            console.log("[OpenClaw] Reconnected to room");
            setStatus("idle", "Ready");
        });

        room.registerTextStreamHandler("lk.transcription", async (reader, participantInfo) => {
            const attrs = reader.info.attributes;
            const segmentId = attrs["lk.segment_id"] || "";
            const isFinal = attrs["lk.transcription_final"] === "true";
            const trackId = attrs["lk.transcribed_track_id"];
            // trackId present = user's audio was transcribed (STT)
            // trackId absent = agent's LLM response text
            const role = trackId ? "user" : "agent";

            const text = await reader.readAll();
            if (text.trim()) {
                console.log(`[OpenClaw] Transcript (${role}${isFinal ? ", final" : ""}):`, text);
                updateTranscript(segmentId, role, text);
                if (role === "agent" && isFinal) {
                    setStatus("speaking", "Speaking...");
                }
                if (role === "user" && isFinal) {
                    setStatus("thinking", "Thinking...");
                }
            }
        });

        console.log("[OpenClaw] Event handlers registered");

        console.log("[OpenClaw] Connecting to LiveKit server...");
        await room.connect(data.url, data.token);
        setStatus("idle", "Ready");
        console.log("[OpenClaw] ✓ Connected to room:", room.name);
        console.log("[OpenClaw] Local participant:", room.localParticipant.identity);
    } catch (err) {
        console.error("[OpenClaw] ✗ Connection failed:", err.message);
        console.error("[OpenClaw] Full error:", err);
        setStatus("idle", "Connection failed");
    }
}

function updateMicUI() {
    if (micEnabled) {
        micIcon.classList.remove("hidden");
        micOffIcon.classList.add("hidden");
        micBtn.classList.add("active");
    } else {
        micIcon.classList.add("hidden");
        micOffIcon.classList.remove("hidden");
        micBtn.classList.remove("active");
    }
}

micBtn.addEventListener("click", async () => {
    if (!room) {
        console.warn("[OpenClaw] Mic clicked but room not connected");
        return;
    }

    micEnabled = !micEnabled;
    console.log("[OpenClaw] Mic toggle:", micEnabled ? "ON" : "OFF");
    updateMicUI();

    try {
        await room.localParticipant.setMicrophoneEnabled(micEnabled);
        if (micEnabled) {
            console.log("[OpenClaw] ✓ Microphone enabled - listening");
            setStatus("listening", "Listening...");
        } else {
            console.log("[OpenClaw] Microphone disabled");
            setStatus("idle", "Ready");
        }
    } catch (err) {
        console.error("[OpenClaw] ✗ Mic toggle failed:", err.message);
        console.error("[OpenClaw] Full error:", err);
        micEnabled = false;
        updateMicUI();
        setStatus("idle", "Mic error");
    }
});

console.log("[OpenClaw] Frontend initialized, connecting...");
connect();
