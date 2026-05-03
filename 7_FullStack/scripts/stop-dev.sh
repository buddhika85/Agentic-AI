#!/bin/bash

# Kanban Project - Stop Development Server
# This script stops and removes the Docker container for the Kanban backend

echo "🛑 Stopping Kanban Development Server..."

# Stop the container
docker stop kanban-backend-dev 2>/dev/null || echo "Container was not running"

# Remove the container
docker rm kanban-backend-dev 2>/dev/null || echo "Container was not found"

echo "✅ Development server stopped successfully"