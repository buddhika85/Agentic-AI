#!/bin/bash

# Kanban Project - Start Development Server
# This script builds and runs the Docker container for the Kanban backend

set -e

echo "🚀 Starting Kanban Development Server..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Build the Docker image
echo "📦 Building Docker image..."
docker build -t kanban-backend .

# Stop any existing container
echo "🛑 Stopping existing container (if running)..."
docker stop kanban-backend-dev 2>/dev/null || true
docker rm kanban-backend-dev 2>/dev/null || true

# Run the container
echo "🏃 Starting container..."
docker run -d \
    --name kanban-backend-dev \
    -p 8000:8000 \
    kanban-backend

# Wait for the container to be ready
echo "⏳ Waiting for server to start..."
sleep 3

# Check if the server is responding
if curl -f http://localhost:8000/api/health > /dev/null 2>&1; then
    echo "✅ Server is running successfully!"
    echo "🌐 Frontend: http://localhost:8000"
    echo "🔍 Health Check: http://localhost:8000/api/health"
else
    echo "❌ Server failed to start properly"
    docker logs kanban-backend-dev
    exit 1
fi