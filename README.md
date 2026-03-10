<div align="center">
  <img src="frontend/public/smartparklogo-clear.png" alt="SmartPark Logo" width="200" height="auto" />
  <h1>SmartPark v6</h1>
  <p><strong>Advanced AI-Powered Intelligent Parking Management System</strong></p>

  <h3>Project Team</h3>
  <p><strong>Pratham Yadav</strong></p>
  <p><strong>Kalepu Yashavardhan</strong></p>

  <br />
</div>

## Overview

**SmartPark v6** is a state-of-the-art parking management solution that leverages **Computer Vision and AI** to monitor parking occupancy in real-time. Moving beyond traditional ultrasonic sensors, v6 introduces a centralized AI vision system that uses a single camera feed to detect vehicles across multiple parking slots simultaneously.

The platform features an **Interactive Floor Plan**, real-time **AI-driven occupancy updates**, and a powerful **Admin ROI Configuration Tool** that allows for flexible, free-form "painting" of parking zones.

## System Architecture

The architecture of SmartPark v6 is designed for high-performance edge computing and real-time visual processing:

1.  **AI Vision Layer (Camera Detector)**:
    -   Powered by **OpenCV** and a **MobileNet SSD** deep learning model.
    -   Processes live RTSP/CSI camera feeds to detect objects (Cars, Motorcycles, etc.).
    -   Performs **Intersection over Union (IoU)** analysis against "Painted" Regions of Interest (ROIs).
    -   Hosted as a dedicated service on **Port 5001**.

2.  **Management Layer (Backend)**:
    -   Built with **FastAPI (Python)** for low-latency API handling.
    -   Synchronizes AI vision data with the global parking state.
    -   Manages user authentication, role-based access (Admin/User), and booking logic.
    -   Implements **A* Pathfinding** for intelligent navigation.

3.  **Presentation Layer (Frontend)**:
    -   High-performance **React.js** + **Vite** SPA.
    -   **Dynamic Canvas Rendering**: Visualizes slot status with smooth GSAP animations.
    -   **Admin Suite**: Exclusive access to the "Configure ROIs" tool featuring a brush-based painting interface for defining parking slots on the live feed.

## Key Capabilities

- **AI-Powered Detection**: Continuous monitoring using deep learning; no physical sensors required per slot.
- **Brush-Paint ROI Configuration (Admin Only)**:
  - Flexibly define parking slots of any shape by "painting" over the live camera feed.
  - Real-time visual feedback on detection overlap.
- **Advanced Booking Engine**:
  - Reserve slots for **Today** and **Tomorrow**.
  - Dynamic conflict resolution and automated slot assignment.
- **Intelligent Navigation**:
  - **Animated Pathfinding**: Optimal A* route calculation from entry to the dead-center of the slot's bottom boundary.
  - **Smart Redirection**: Suggests alternative levels/slots when capacity is reached.
- **Role-Based Access Control**:
  - **Admin (User 4)**: Exclusive access to Live Camera Feeds and ROI Configuration.
  - **Standard User**: Streamlined booking and navigation experience.

---

## Technology Stack

### Software
- **AI/Vision**: OpenCV, MobileNet SSD (Caffe), NumPy.
- **Frontend**: React.js, Vite, HTML5 Canvas, GSAP.
- **Backend**: FastAPI, Flask (Vision Service), Uvicorn.
- **Data**: JSON-based persistence for ROIs and Slot configurations.

### Hardware
- **Central Processing**: Raspberry Pi 4 / High-performance PC.
- **Vision Hardware**: Raspberry Pi Camera Module / USB Webcam / RTSP IP Camera.

---

## Installation & Deployment

### 1. Repository Setup
```bash
git clone https://github.com/YourRepo/SmartPark.git
cd smartparkv6
```

### 2. Environment Setup
```bash
# Install Python dependencies
pip install -r backend/requirements.txt
# Ensure OpenCV and DNN modules are available
```

### 3. Frontend Initialization
```bash
cd frontend
npm install
cd ..
```

### 4. Application Launch
The system requires both the Management Backend and the Vision Detector to be running:
```bash
# Start all services (Backend + Vision + Frontend)
chmod +x run_dev.sh
./run_dev.sh
```
- **Management API**: `http://localhost:8000`
- **Vision Detector**: `http://localhost:5001`
- **User Interface**: `http://localhost:5173`

---

## User & Admin Manual

### **For Users**
1. **Login**: Use demo credentials (e.g., User 1/2/3).
2. **Book**: Select a green slot, choose timing, and confirm.
3. **Navigate**: Hit **NAVIGATE** to see the animated path to your spot.

### **For Admins (User 4)**
1. **Configure ROIs**: Click the **⚙️ Configure ROIs** button in the top header.
2. **Paint Slots**: Select a Slot ID, then **click and drag** over the live video feed to define its area.
3. **Save**: Click **Save** to update the detector's logic immediately.

---

<div align="center">
  <p>Maintained by <strong>Pratham Yadav and Kalepu Yashvardhan</strong></p>
</div>
