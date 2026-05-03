param(
    [switch]$NoWait
)

Write-Host "🚀 Starting Kanban Development Server..." -ForegroundColor Green

# Change to project root directory
Set-Location $PSScriptRoot\..

# Check if Docker is running
try {
    docker info | Out-Null
} catch {
    Write-Host "❌ Docker is not running. Please start Docker and try again." -ForegroundColor Red
    exit 1
}

# Build the Docker image
Write-Host "📦 Building Docker image..." -ForegroundColor Yellow
docker build -t kanban-backend .

# Stop any existing container
Write-Host "🛑 Stopping existing container (if running)..." -ForegroundColor Yellow
docker stop kanban-backend-dev 2>$null | Out-Null
docker rm kanban-backend-dev 2>$null | Out-Null

# Run the container
Write-Host "🏃 Starting container..." -ForegroundColor Yellow
docker run -d `
    --name kanban-backend-dev `
    -p 8000:8000 `
    kanban-backend

if (-not $NoWait) {
    # Wait for the container to be ready
    Write-Host "⏳ Waiting for server to start..." -ForegroundColor Yellow
    Start-Sleep -Seconds 3

    # Check if the server is responding
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8000/api/health" -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ Server is running successfully!" -ForegroundColor Green
            Write-Host "🌐 Frontend: http://localhost:8000" -ForegroundColor Cyan
            Write-Host "🔍 Health Check: http://localhost:8000/api/health" -ForegroundColor Cyan
        } else {
            throw "Unexpected status code: $($response.StatusCode)"
        }
    } catch {
        Write-Host "❌ Server failed to start properly" -ForegroundColor Red
        docker logs kanban-backend-dev
        exit 1
    }
} else {
    Write-Host "✅ Container started (no wait requested)" -ForegroundColor Green
}