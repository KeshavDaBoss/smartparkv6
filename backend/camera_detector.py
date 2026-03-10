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

# Default ROIs (Empty for painting)
ROIS = {
    "M2-L1-S1": [],
    "M2-L1-S2": [],
    "M2-L1-S3": [],
    "M2-L1-S4": [],
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

def get_iou(slot_pts, car_box):
    """
    Calculate the intersection coverage of a painted path and a rectangular car box.
    """
    try:
        x, y, w, h = car_box
        
        # Create an empty mask for the slot painted path
        slot_mask = np.zeros((480, 640), dtype=np.uint8)
        pts = np.array(slot_pts, np.int32)
        pts = pts.reshape((-1, 1, 2))
        cv2.polylines(slot_mask, [pts], isClosed=False, color=255, thickness=40)
        
        # Create an empty mask for the car bounding box
        car_mask = np.zeros((480, 640), dtype=np.uint8)
        cv2.rectangle(car_mask, (x, y), (x + w, y + h), 255, -1)
        
        # Calculate intersection
        intersection = cv2.bitwise_and(slot_mask, car_mask)
        
        slot_area = np.count_nonzero(slot_mask)
        if slot_area == 0:
            return 0.0
            
        intersection_area = np.count_nonzero(intersection)
        return intersection_area / float(slot_area)
    except Exception as e:
        print(f"Error calculating coverage: {e}")
        return 0.0

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
                if confidence > 0.15:
                    idx = int(detections[0, 0, i, 1])
                    if CLASSES[idx] in ["car", "bus"]:
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
        
        # Create a single semi-transparent overlay for all ROIs
        overlay = frame.copy()
        for slot_id, slot_pts in ROIS.items():
            if not slot_pts or len(slot_pts) < 2:
                continue # Need at least a line

            is_occupied = False
            
            # Check intersection with any detected car
            for car_box in car_boxes:
                coverage = get_iou(slot_pts, car_box)
                if coverage > 0.05: # If just 5% of the ROI path is covered
                    is_occupied = True
                    break
            
            slot_status[slot_id] = "OCCUPIED" if is_occupied else "FREE"
            
            # Draw ROI on overlay
            color = (0, 0, 255) if is_occupied else (0, 255, 0)
            pts = np.array(slot_pts, np.int32).reshape((-1, 1, 2))
            
            cv2.polylines(overlay, [pts], isClosed=False, color=color, thickness=40)
            cv2.putText(frame, slot_id, (slot_pts[0][0], max(30, slot_pts[0][1]-30)), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
            
        cv2.addWeighted(overlay, 0.4, frame, 0.6, 0, frame)

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
        response = app.make_default_options_response()
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
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
