"""
Module Vérif-Média — détection de deepfakes via EfficientNet.

Modèle attendu : models/deepfake_efficientnet.pth
Fine-tuné sur FaceForensics++ (binaire : réel=0, manipulé=1).
"""
from __future__ import annotations

import httpx
import torch
import torchvision.transforms as T
from PIL import Image
from io import BytesIO
from pathlib import Path

MODEL_PATH = Path("models/deepfake_efficientnet.pth")
IMG_SIZE = 380


class MediaModule:
    def __init__(self):
        self._model = None
        self._transform = T.Compose([
            T.Resize((IMG_SIZE, IMG_SIZE)),
            T.ToTensor(),
            T.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ])

    def _load_model(self):
        if self._model is not None:
            return
        try:
            from efficientnet_pytorch import EfficientNet
            model = EfficientNet.from_pretrained("efficientnet-b4")
            model._fc = torch.nn.Linear(model._fc.in_features, 1)
            if MODEL_PATH.exists():
                model.load_state_dict(torch.load(MODEL_PATH, map_location="cpu"))
            model.eval()
            self._model = model
        except Exception as e:
            raise RuntimeError(f"Impossible de charger le modèle deepfake : {e}")

    async def analyze(self, image_url: str) -> dict:
        try:
            self._load_model()

            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(image_url)
            resp.raise_for_status()

            img = Image.open(BytesIO(resp.content)).convert("RGB")
            tensor = self._transform(img).unsqueeze(0)

            with torch.no_grad():
                logit = self._model(tensor)
                prob = float(torch.sigmoid(logit).squeeze())

            if prob >= 0.70:
                label = "probable deepfake"
            elif prob >= 0.35:
                label = "image potentiellement modifiée"
            else:
                label = "image authentique"

            return {"score": round(prob, 3), "label": label}

        except Exception as e:
            return {"score": None, "label": "erreur d'analyse image", "error": str(e)}
