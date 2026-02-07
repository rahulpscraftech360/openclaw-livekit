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
        const resp = await fetch(TOKEN_URL);
        const data = await resp.json();

        room = new Room();

        room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
            if (track.kind === Track.Kind.Audio) {
                const el = track.attach();
                document.body.appendChild(el);
            }
        });

        room.on(RoomEvent.TrackUnsubscribed, (track) => {
            track.detach().forEach((el) => el.remove());
        });

        room.on(RoomEvent.ParticipantConnected, (participant) => {
            console.log("Agent connected:", participant.identity);
        });

        room.on(RoomEvent.Disconnected, () => {
            setStatus("idle", "Disconnected");
            micEnabled = false;
            updateMicUI();
        });

        room.registerTextStreamHandler("lk.transcription", async (reader, participantInfo) => {
            const attrs = reader.info.attributes;
            const segmentId = attrs["lk.segment_id"] || "";
            const isFinal = attrs["lk.transcription_final"] === "true";
            const trackId = attrs["lk.transcribed_track_id"];
            const role = trackId ? "agent" : "user";

            const text = await reader.readAll();
            if (text.trim()) {
                updateTranscript(segmentId, role, text);
                if (role === "agent" && isFinal) {
                    setStatus("speaking", "Speaking...");
                }
            }
        });

        await room.connect(data.url, data.token);
        setStatus("idle", "Ready");
        console.log("Connected to room:", room.name);
    } catch (err) {
        console.error("Connection failed:", err);
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
    if (!room) return;

    micEnabled = !micEnabled;
    updateMicUI();

    try {
        await room.localParticipant.setMicrophoneEnabled(micEnabled);
        if (micEnabled) {
            setStatus("listening", "Listening...");
        } else {
            setStatus("idle", "Ready");
        }
    } catch (err) {
        console.error("Mic toggle failed:", err);
        micEnabled = false;
        updateMicUI();
        setStatus("idle", "Mic error");
    }
});

connect();
