# Kanban Project - Stop Development Server (Windows)
# This script stops and removes the Docker container for the Kanban backend

Write-Host "🛑 Stopping Kanban Development Server..." -ForegroundColor Yellow

# Stop the container
docker stop kanban-backend-dev 2>$null | Out-Null

# Remove the container
docker rm kanban-backend-dev 2>$null | Out-Null

Write-Host "✅ Development server stopped successfully" -ForegroundColor Green