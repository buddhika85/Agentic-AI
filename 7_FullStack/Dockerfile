# Stage 1: build frontend assets
FROM node:20-alpine AS frontend-build
WORKDIR /tmp/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Stage 2: app image
FROM python:3.11-slim

WORKDIR /app

RUN pip install uv

COPY backend/pyproject.toml ./
RUN uv pip install --system -r pyproject.toml

COPY backend/ ./
COPY --from=frontend-build /tmp/frontend/out ./frontend/out

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
