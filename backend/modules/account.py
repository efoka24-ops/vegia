"""
Module Vérif-Compte — détection d'usurpation d'identité institutionnelle.

Stratégie : heuristique sur le nom du profil (revendication d'appartenance officielle)
croisée avec un registre de comptes officiels en base (table official_accounts).
Volontairement limité aux institutions / figures publiques — pas de matching biométrique
sur des particuliers. Pas de dépendance ML.
"""
from __future__ import annotations

import re

from sqlalchemy import text

from db.session import get_db_connection

OFFICIAL_PATTERN = re.compile(
    r"minist|gouvernement|présidence|presidence|république|republique|"
    r"campost|minpostel|antic|beac|injs|police|gendarm|douane|impôts|impots|"
    r"officiel|official|ambassade|consulat",
    re.I,
)


class AccountModule:
    def _registry_names(self) -> list[str]:
        """Noms des comptes officiels connus (best-effort ; vide si DB indisponible)."""
        try:
            with get_db_connection() as conn:
                rows = conn.execute(text("SELECT name FROM official_accounts")).fetchall()
            return [r[0].lower() for r in rows if r[0]]
        except Exception:
            return []

    async def analyze(self, profile_image_url: str, profile_name: str) -> dict:
        try:
            name = (profile_name or "").strip()
            if not name:
                return {"score": 0.0, "label": "nom de profil absent — analyse impossible"}

            claims_official = bool(OFFICIAL_PATTERN.search(name))
            registry = self._registry_names()
            in_registry = any(name.lower() == ref or name.lower() in ref for ref in registry)

            if in_registry:
                return {"score": 0.05, "label": f"compte officiel vérifié : {name}"}

            if claims_official:
                return {
                    "score": 0.85,
                    "label": "usurpation probable — revendique une identité officielle non vérifiée",
                }

            return {"score": 0.1, "label": "aucune usurpation institutionnelle détectée"}

        except Exception as e:
            return {"score": None, "label": "erreur analyse du compte", "error": str(e)}
