# LiteLLM callback: one JSON line per model call with token usage, for the cost baseline.
import json, os, time
from litellm.integrations.custom_logger import CustomLogger

LOG = os.path.join(os.path.dirname(__file__), "usage.jsonl")

class UsageLogger(CustomLogger):
    async def async_log_success_event(self, kwargs, response_obj, start_time, end_time):
        try:
            u = getattr(response_obj, "usage", None) or {}
            get = (lambda k: getattr(u, k, None)) if not isinstance(u, dict) else u.get
            details = get("prompt_tokens_details") or {}
            cached = getattr(details, "cached_tokens", None) if not isinstance(details, dict) else details.get("cached_tokens")
            row = {
                "ts": time.time(),
                "model": kwargs.get("model"),
                "input": get("prompt_tokens"),
                "output": get("completion_tokens"),
                "cached": cached or 0,
                "latency_s": (end_time - start_time).total_seconds(),
            }
            with open(LOG, "a", encoding="utf-8") as f:
                f.write(json.dumps(row) + "\n")
        except Exception as e:  # never break the proxy
            with open(LOG + ".err", "a", encoding="utf-8") as f:
                f.write(repr(e) + "\n")

proxy_handler_instance = UsageLogger()
