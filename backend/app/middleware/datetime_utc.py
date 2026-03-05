"""
Datetime UTC Middleware for FastAPI

MongoDB stores all datetimes as UTC. pymongo/Motor returns naive datetimes (no tzinfo).
FastAPI serializes them as ISO strings WITHOUT timezone suffix (e.g., "2026-02-27T15:30:00").
Browsers treat such strings as LOCAL time, causing incorrect display.

This middleware appends 'Z' to all naive datetime ISO strings in JSON responses,
telling the browser the timestamps are UTC. The frontend then correctly converts
to IST using `timeZone: 'Asia/Kolkata'` in Intl.DateTimeFormat / toLocaleString.

Flow:
  MongoDB (UTC) → pymongo (naive UTC) → FastAPI ("2026-02-27T15:30:00")
  → This middleware ("2026-02-27T15:30:00Z")
  → Browser (knows it's UTC) → displays as IST via timeZone option
"""

import re
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

# Match ISO datetime strings in JSON that DON'T already have timezone info
# Matches: "2026-02-27T15:30:00" or "2026-02-27T15:30:00.123456"
# Does NOT match: "2026-02-27T15:30:00Z" or "2026-02-27T15:30:00+05:30" or "2026-02-27" (date only)
ISO_NAIVE_DT_PATTERN = re.compile(
    r'"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?)"'
)


class DatetimeUTCMiddleware(BaseHTTPMiddleware):
    """
    Middleware that appends 'Z' (UTC indicator) to all naive ISO datetime
    strings in JSON responses. This ensures the browser correctly interprets
    timestamps as UTC and can convert them to the user's timezone (IST).
    """

    async def dispatch(self, request, call_next):
        response = await call_next(request)

        # Only process JSON responses
        content_type = response.headers.get('content-type', '')
        if not content_type.startswith('application/json'):
            return response

        # Read the response body
        body_chunks = []
        async for chunk in response.body_iterator:
            if isinstance(chunk, bytes):
                body_chunks.append(chunk)
            else:
                body_chunks.append(chunk.encode('utf-8'))

        body = b''.join(body_chunks)

        try:
            body_str = body.decode('utf-8')

            # Append Z to all naive datetime ISO strings
            body_str = ISO_NAIVE_DT_PATTERN.sub(
                lambda m: f'"{m.group(1)}Z"',
                body_str
            )

            body = body_str.encode('utf-8')
        except (UnicodeDecodeError, Exception):
            # If anything goes wrong, return original response
            pass

        # Build new response with modified body
        # Preserve all original headers except content-length (it may change)
        headers = dict(response.headers)
        headers['content-length'] = str(len(body))

        return Response(
            content=body,
            status_code=response.status_code,
            headers=headers,
            media_type=response.media_type,
        )
