# Dockerfile racine — force Railway à construire le backend Python
# (sans dépendre du réglage "Root Directory" du dashboard).
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

EXPOSE 8000

# Forme shell pour que ${PORT} (injecté par Railway) soit développé.
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
