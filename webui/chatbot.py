"""Compatibility alias; chatbot implementation lives in app.services.chatbot."""
import sys
from app.services import chatbot as _implementation
sys.modules[__name__] = _implementation
