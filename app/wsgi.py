"""WSGI entry point: waitress-serve app.wsgi:app."""
from app.api import app

__all__ = ['app']
