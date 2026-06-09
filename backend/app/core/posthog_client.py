"""PostHog analytics client — instance-based, initialized at app startup."""

import atexit
import os
from typing import Optional

from posthog import Posthog

_client: Optional[Posthog] = None


def init_posthog() -> None:
    global _client
    token = os.environ.get("POSTHOG_PROJECT_TOKEN", "")
    host = os.environ.get("POSTHOG_HOST", "")
    if not token or token == "<ph_project_token>":
        return
    kwargs: dict = {"project_api_key": token}
    if host:
        kwargs["host"] = host
    _client = Posthog(**kwargs)
    atexit.register(_client.shutdown)


def shutdown_posthog() -> None:
    if _client:
        _client.shutdown()


def get_posthog() -> Optional[Posthog]:
    return _client
