import os

from aiohttp import web
from dotenv import load_dotenv
from livekit.api import AccessToken, VideoGrants

load_dotenv(".env.local")

LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "devkey")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "secret")
LIVEKIT_URL = os.getenv("LIVEKIT_URL", "ws://localhost:7880")
ROOM_NAME = "openclaw-voice"


async def handle_token(request: web.Request) -> web.Response:
    identity = request.query.get("identity", "user")
    token = (
        AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        .with_identity(identity)
        .with_grants(VideoGrants(room_join=True, room=ROOM_NAME))
        .with_ttl(3600)
        .to_jwt()
    )
    return web.json_response({"token": token, "url": LIVEKIT_URL})


app = web.Application()
app.router.add_route("GET", "/token", handle_token)
app.router.add_route("OPTIONS", "/token", lambda r: web.Response(status=204, headers={
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
}))


@web.middleware
async def cors_middleware(request: web.Request, handler):
    response = await handler(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response


app.middlewares.append(cors_middleware)

if __name__ == "__main__":
    print(f"Token server running on http://localhost:8081/token")
    print(f"LiveKit URL: {LIVEKIT_URL}")
    print(f"Room: {ROOM_NAME}")
    web.run_app(app, host="127.0.0.1", port=8081)
