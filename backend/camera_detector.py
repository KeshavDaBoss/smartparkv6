import cv2
import numpy as np
import time
import requests
import json
import os
from flask import Flask, Response, request
import threading

app = Flask(__name__)

# Config
API_URL = "http://localhost:8000/sensor/camera"
CAMERA_INDEX = 0
ROI_FILE = "rois.json"

# Load MobileNet SSD
script_dir = os.path.dirname(os.path.abspath(__file__))
prototxt = os.path.join(script_dir, "MobileNetSSD_deploy.prototxt")
model = os.path.join(script_dir, "MobileNetSSD_deploy.caffemodel")

# Check if model files exist
if not os.path.exists(prototxt) or not os.path.exists(model):
    print("WARNING: MobileNetSSD files not found in backend/. AI detection will fail.")
    net = None
else:
    net = cv2.dnn.readNetFromCaffe(prototxt, model)

# MobileNet SSD Classes
CLASSES = ["background", "aeroplane", "bicycle", "bird", "boat",
           "bottle", "bus", "car", "cat", "chair", "cow", "diningtable",
           "dog", "horse", "motorbike", "person", "pottedplant", "sheep",
           "sofa", "train", "tvmonitor"]

# Default ROIs
ROIS = {
    "M2-L1-S1": [50, 200, 100, 100],
    "M2-L1-S2": [170, 200, 100, 100],
    "M2-L1-S3": [290, 200, 100, 100],
    "M2-L1-S4": [410, 200, 100, 100],
}

def load_rois():
    global ROIS
    roi_path = os.path.join(script_dir, ROI_FILE)
    if os.path.exists(roi_path):
        try:
            with open(roi_path, 'r') as f:
                saved_rois = json.load(f)
                ROIS.update(saved_rois)
                print("Loaded ROIs from file.")
        except Exception as e:
            print(f"Failed to load ROIs: {e}")

def save_rois():
    roi_path = os.path.join(script_dir, ROI_FILE)
    try:
        with open(roi_path, 'w') as f:
            json.dump(ROIS, f)
            print("Saved ROIs to file.")
    except Exception as e:
        print(f"Failed to save ROIs: {e}")

load_rois()

# Shared frame for streaming
output_frame = None

def get_iou(bb1, bb2):
    """
    Calculate the Intersection over Union (IoU) of two bounding boxes.
    bb = [x, y, w, h]
    """
    x1, y1, w1, h1 = bb1
    x2, y2, w2, h2 = bb2
    
    # Coordinates of the intersection rectangle
    x_left = max(x1, x2)
    y_top = max(y1, y2)
    x_right = min(x1 + w1, x2 + w2)
    y_bottom = min(y1 + h1, y2 + h2)

    if x_right < x_left or y_bottom < y_top:
        return 0.0

    intersection_area = (x_right - x_left) * (y_bottom - y_top)
    
    # Area of bb1 (the slot ROI)
    bb1_area = w1 * h1
    
    # We care about how much of the slot is covered by the car.
    # Alternatively, you can use standard IoU. Here, intersection / ROI area is often better for parking.
    return intersection_area / float(bb1_area)

def process_frame():
    global output_frame
    cap = cv2.VideoCapture(CAMERA_INDEX)
    time.sleep(2.0)
    last_api_update = 0
    
    while True:
        ret, frame = cap.read()
        if not ret:
            time.sleep(1)
            continue
            
        frame = cv2.resize(frame, (640, 480))
        h, w = frame.shape[:2]
        
        # Detect cars if net is loaded
        car_boxes = []
        if net is not None:
            blob = cv2.dnn.blobFromImage(cv2.resize(frame, (300, 300)), 0.007843, (300, 300), 127.5)
            net.setInput(blob)
            detections = net.forward()
            
            for i in np.arange(0, detections.shape[2]):
                confidence = detections[0, 0, i, 2]
                if confidence > 0.4:
                    idx = int(detections[0, 0, i, 1])
                    if CLASSES[idx] == "car":
                        # Compute coordinates
                        box = detections[0, 0, i, 3:7] * np.array([w, h, w, h])
                        (startX, startY, endX, endY) = box.astype("int")
                        
                        # Store as [x, y, width, height]
                        car_w = endX - startX
                        car_h = endY - startY
                        car_boxes.append([startX, startY, car_w, car_h])
                        
                        # Draw car bounding box in yellow
                        cv2.rectangle(frame, (startX, startY), (endX, endY), (0, 255, 255), 2)
                        cv2.putText(frame, f"Car: {confidence*100:.1f}%", (startX, startY - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)

        slot_status = {}
        for slot_id, (rx, ry, rw, rh) in ROIS.items():
            is_occupied = False
            
            # Check intersection with any detected car
            for car_box in car_boxes:
                coverage = get_iou([rx, ry, rw, rh], car_box)
                if coverage > 0.3: # If 30% of the ROI is covered by a car bounding box
                    is_occupied = True
                    break
            
            slot_status[slot_id] = "OCCUPIED" if is_occupied else "FREE"
            
            # Draw ROI on frame
            color = (0, 0, 255) if is_occupied else (0, 255, 0)
            cv2.rectangle(frame, (rx, ry), (rx+rw, ry+rh), color, 2)
            cv2.putText(frame, slot_id, (rx, ry-10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

        output_frame = frame.copy()
        
        # POST to backend every 2 seconds
        current_time = time.time()
        if current_time - last_api_update > 2.0:
            payload = {
                "source": "camera_mall2",
                "statuses": slot_status
            }
            try:
                requests.post(API_URL, json=payload, timeout=1)
            except requests.exceptions.RequestException as e:
                print(f"API Update Failed: {e}")
            last_api_update = current_time
            
        time.sleep(0.05)

def generate_mjpeg():
    global output_frame
    while True:
        if output_frame is not None:
            ret, buffer = cv2.imencode('.jpg', output_frame)
            if ret:
                frame_bytes = buffer.tobytes()
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        time.sleep(0.05)

@app.route('/video_feed')
def video_feed():
    return Response(generate_mjpeg(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/config_rois', methods=['POST', 'OPTIONS'])
def config_rois():
    if request.method == 'OPTIONS':
        # Quick and dirty CORS for the setup tool
        response = app.make_default_options_response()
        headers = None
        if 'ACCESS_CONTROL_REQUEST_HEADERS' in request.headers:
            headers = request.headers['ACCESS_CONTROL_REQUEST_HEADERS']
        
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'POST'
        response.headers['Access-Control-Allow-Headers'] = headers
        return response
        
    global ROIS
    data = request.json
    for slot_id, coords in data.items():
        if slot_id in ROIS:
            ROIS[slot_id] = coords
    save_rois()
    
    response = app.response_class(
        response=json.dumps({"status": "updated", "rois": ROIS}),
        status=200,
        mimetype='application/json'
    )
    response.headers['Access-Control-Allow-Origin'] = '*'
    return response

@app.route('/get_rois', methods=['GET'])
def get_rois():
    response = app.response_class(
        response=json.dumps({"rois": ROIS}),
        status=200,
        mimetype='application/json'
    )
    response.headers['Access-Control-Allow-Origin'] = '*'
    return response

if __name__ == '__main__':
    t = threading.Thread(target=process_frame, daemon=True)
    t.start()
    
    # Run on port 5001 to avoid AirPlay conflict on macOS
    app.run(host='0.0.0.0', port=5001, debug=False, use_reloader=False)
