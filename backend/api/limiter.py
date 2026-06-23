"""Limiter de débit partagé (slowapi), importé par main.py et le router."""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=[])
