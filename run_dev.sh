#!/bin/bash

# Trap Ctrl+C to kill all background processes
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

echo "Starting SmartPark..."

# Check if venv exists
if [ ! -f "venv/bin/activate" ]; then
    echo "Error: Python venv not found. Please run ./setup_pi.sh first."
    exit 1
fi

echo "Starting Backend (FastAPI)..."
source venv/bin/activate
# Run uvicorn in background
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

echo "Starting Camera Detector (Port 5001)..."
python backend/camera_detector.py &
CAMERA_PID=$!
echo "Camera Detector PID: $CAMERA_PID"

# Wait for backend
sleep 3

# Check frontend
if [ ! -d "frontend" ]; then
    echo "Error: frontend directory not found."
    kill $BACKEND_PID
    exit 1
fi

echo "Starting Frontend (Vite)..."
cd frontend
# Check npm
if ! command -v npm &> /dev/null; then
    echo "Error: npm could not be found. Please install Node.js."
    kill $BACKEND_PID
    exit 1
fi

npm run dev &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo "SmartPark is running!"
echo "Backend: http://localhost:8000"
echo "Camera Feed API: http://localhost:5001/video_feed"
echo "Frontend: http://localhost:5173"
echo "Press Ctrl+C to stop."

# Wait for all processes
wait $BACKEND_PID $CAMERA_PID $FRONTEND_PID
