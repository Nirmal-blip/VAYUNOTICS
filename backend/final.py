# --- SIMPLE ACCELEROMETER CALIBRATION ENDPOINT ---
from fastapi import HTTPException
from fastapi import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pymavlink import mavutil
from scipy.spatial import ConvexHull
import os
from shapely.geometry import Polygon, LineString
import math
import cv2
from fastapi.responses import StreamingResponse
import utm
import asyncio
import threading
from serial import Serial
import time
from enum import Enum
from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional, Dict
import logging
import numpy as np
from contextlib import contextmanager
import concurrent.futures
import psutil
import tracemalloc

# --- FLIGHT MODES MAP (ArduCopter example, extend as needed) ---
ARDUPILOT_FLIGHT_MODES = {
    0: "Stabilize",
    1: "Acro",
    2: "AltHold",
    3: "Auto",
    4: "Guided",
    5: "Loiter",
    6: "RTL",
    7: "Circle",
    9: "Land",
    11: "Drift",
    13: "Sport",
    14: "Flip",
    15: "AutoTune",
    16: "Position",
    17: "Brake",
    18: "Throw",
    19: "Avoid_ADSB",
    20: "Guided_NoGPS",
    21: "SmartRTL"
}

# asyncio.get_running_loop().set_default_executor(concurrent.futures.ThreadPoolExecutor(max_workers=20))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global state with thread safety
connection = None
mission_event = threading.Event()
current_mission = []
message_thread = None
boot_time = time.time()
connection_lock = threading.Lock()
video_capture = None
video_thread = None
frame_buffer = None
frame_lock = threading.Lock()
video_active = threading.Event()  
mission_ack_received=None

connection_state = {
    "websocket_clients": set(),
    "last_activity": time.time()
}
# Connection parameters
DEFAULT_CONNECTION_STRING = "tcp:127.0.0.1:5760"
DEFAULT_BAUD_RATE = 57600
MAX_RECONNECT_ATTEMPTS = 5
RECONNECT_DELAY = 2
connection_params = {
    "comPort": None,
    "baudRate": DEFAULT_BAUD_RATE,
}

@contextmanager
def debug_lock(lock):
    logger.info("Acquiring lock...")
    lock.acquire()
    try:
        yield
    finally:
        logger.info("Releasing lock...")
        lock.release()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage startup and shutdown events"""
    global connection, message_thread, video_capture, video_thread
    # loop = asyncio.get_running_loop()
    # loop.set_default_executor(concurrent.futures.ThreadPoolExecutor(max_workers=20))
    # tracemalloc.start()
    logger.info(f"tracemalloc started, tracing: {tracemalloc.is_tracing()}")
    
    # Startup logic
    logger.info("🚀 Starting MAVLink connection...")
    with debug_lock(connection_lock):
        connection = connect_mavlink()
    message_thread = threading.Thread(target=handle_messages, daemon=True)
    message_thread.start()
    
    # # Initialize video capture
    # video_url = os.getenv("VIDEO_STREAM_URL", "rtsp://192.168.1.1/live")
    # logger.info(f"📹 Initializing video capture from {video_url}")
    # try:
    #     video_capture = cv2.VideoCapture(video_url)
    #     if video_capture.isOpened():
    #         video_active.set()
    #         video_thread = threading.Thread(target=update_video_frames, daemon=True)
    #         video_thread.start()
    #         logger.info("✅ Video capture started")
    #     else:
    #         logger.error("❌ Failed to open video stream")
    # except Exception as e:
    #     logger.error(f"⚠️ Video initialization failed: {e}")

    yield  # Application runs here
    
    # Shutdown logic
    logger.info("🛑 Shutting down...")
    with debug_lock(connection_lock):
        if connection:
            connection.close()
    if message_thread:
        message_thread.join(timeout=1)
    video_active.clear()
    if video_capture:
        video_capture.release()
    if video_thread:
        video_thread.join(timeout=2)
        
def wait_for_arm(timeout=5):
    """
    Wait until drone is armed, with timeout.
    Raises TimeoutError if not armed in time.
    """
    start_time = time.time()
    while True:
        # connection.mav.heartbeat_send()  # you can send heartbeat if necessary
        # connection.recv_match(blocking=False)
        print("Here1")
        if connection.motors_armed():
            logger.info("✅ Motors are armed!")
            return
        print("Here2")
        if time.time() - start_time > timeout:
            raise TimeoutError("Timeout: Motors did not arm within expected time")
        
        time.sleep(0.5)

def wait_for_disarm(timeout=5):
    """
    Wait until drone is disarmed, with timeout.
    Raises TimeoutError if not disarmed in time.
    """
    start_time = time.time()
    while True:
        # connection.mav.heartbeat_send()  # optional
        # connection.recv_match(blocking=False)
        
        if not connection.motors_armed():
            logger.info("✅ Motors are disarmed!")
            return
        
        if time.time() - start_time > timeout:
            raise TimeoutError("Timeout: Motors did not disarm within expected time")
        time.sleep(0.5)
async def async_wait_for_arm(timeout=5):
    await asyncio.to_thread(wait_for_arm, timeout)
async def async_wait_for_disarm(timeout=5):
    await asyncio.to_thread(wait_for_disarm, timeout)
app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CheckType(str, Enum):
    AUTOMATED = "automated"
    MANUAL = "manual"

class CheckSeverity(str, Enum):
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"

class PreflightCheck(BaseModel):
    id: str
    name: str
    description: str
    check_type: CheckType
    severity: CheckSeverity

class PreflightCheckResult(BaseModel):
    check_id: str
    status: bool
    message: Optional[str] = None
    timestamp: datetime

class PreflightStatus(str, Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

class RadioConfig(BaseModel):
    port: str = "/dev/ttyUSB0"
    baudrate: int = DEFAULT_BAUD_RATE
    commands: List[str]

class RadioPreset(str, Enum):
    SHORT_RANGE = "short_range"
    LONG_RANGE = "long_range"

class FailsafeSettings(BaseModel):
    fs_action: int
    fs_alt: float
    

class FlyHereRequest(BaseModel):
    lat: float
    lon: float
    alt: float
    
class ParameterRequest(BaseModel):
    param: str
    value: float
# Global state
class AccelConfirmStepRequest(BaseModel):
    vehiclePos: int

# --- GET PARAMETER ENDPOINT ---
@app.get("/get_parameter/{param_id}")
async def get_parameter(param_id: str = Path(..., description="Parameter name, e.g. FRAME_TYPE")):
    """Get the value of a specific parameter from the drone."""
    import time
    with debug_lock(connection_lock):
        if not connection:
            logger.warning("Attempt to get parameter with no connection")
            raise HTTPException(status_code=400, detail="No active connection")
        try:
            # Request the parameter (non-blocking)
            connection.param_fetch_one(param_id)
            # Wait for the parameter to be available (with timeout)
            timeout = 5  # seconds
            poll_interval = 0.1
            waited = 0
            value = None
            while waited < timeout:
                value = connection.params.get(param_id)
                if value is not None:
                    break
                time.sleep(poll_interval)
                waited += poll_interval
            if value is None:
                logger.warning(f"Parameter {param_id} not found or not received in time")
                raise HTTPException(status_code=404, detail=f"Parameter {param_id} not found or not received in time")
            logger.info(f"Parameter {param_id} value: {value}")
            return {"name": param_id, "value": value}
        except Exception as e:
            logger.error(f"Failed to get parameter {param_id}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to get parameter: {str(e)}")
    vehiclePos: int

sensor_data_lock = threading.Lock()
preflight_checks_db = []
preflight_results_db = []
current_preflight_status = PreflightStatus.PENDING

latest_sensor_data = {
    "gps": {"fix_type": 0, "satellites": 0},
    "battery": {"voltage": 0.0, "remaining": 0},
    "compass": {"calibrated": False},
    "arming": {"armed": False},
    "radio": {
        "rssi": 0,
        "remote_rssi": 0,
        "noise": 0,
        "remote_noise": 0,
        "tx_buffer": 0,
        "packet_errors": 0,
        "link_quality": 80
    }
}

RADIO_PRESETS = {
    RadioPreset.SHORT_RANGE: {
        "commands": ["ATS3=5", "ATS4=64", "ATS5=1", "ATS6=12", "AT&W"],
        "description": "High bandwidth for <500m operations"
    },
    RadioPreset.LONG_RANGE: {
        "commands": ["ATS3=7", "ATS4=8", "ATS5=1", "ATS6=20", "AT&W"],
        "description": "Long range (>1km) with lower bandwidth"
    }
}

def sanitize_mavlink_data(data):
    """Recursively sanitize MAVLink data for JSON serialization"""
    if isinstance(data, dict):
        return {k: sanitize_mavlink_data(v) for k, v in data.items()}
    elif isinstance(data, (bytearray, bytes)):
        return data.hex()
    elif isinstance(data, list):
        return [sanitize_mavlink_data(item) for item in data]
    elif hasattr(data, 'to_dict'):
        return sanitize_mavlink_data(data.to_dict())
    return data

def connect_mavlink():
    """Establish MAVLink connection with robust error handling"""
    global connection_params
    connection_string = connection_params.get("comPort",DEFAULT_CONNECTION_STRING)
    # connection_string="tcp:127.0.0.1:5760"
    baud_rate = connection_params.get("baudRate", DEFAULT_BAUD_RATE)
    conn = None
    print(connection_string)
    
    try:
        logger.info(f"Attempting connection to {connection_string} at {baud_rate} baud")
        conn = mavutil.mavlink_connection(
            connection_string,
            baud=baud_rate,
            source_system=255,
            source_component=0,
            autoreconnect=True
        )
        logger.info("⌛ Waiting for heartbeat...")
        conn.wait_heartbeat(timeout=10)
        conn.mav.request_data_stream_send(
            conn.target_system,
            conn.target_component,
            mavutil.mavlink.MAV_DATA_STREAM_ALL,
            1,  # Hz (messages per second)
            1   # Start streaming
        )
        logger.info(f"✅ MAVLink Connected via {connection_string}!")
        logger.info(f"🔗 System ID: {conn.target_system}, Component ID: {conn.target_component}")
        return conn
    except Exception as e:
        logger.error(f"⚠️ Connection failed: {e}")
        if conn:
            conn.close()
        return None


# def handle_messages():
#     """Improved message handler with thread safety and robust reconnection"""
#     global connection
#     reconnect_attempts = 0
    
#     while True:
#         try:
#             with debug_lock(connection_lock):
#                 current_conn = connection
#             if not current_conn:
#                 if reconnect_attempts >= MAX_RECONNECT_ATTEMPTS:
#                     logger.warning("⚠️ Max reconnection attempts reached, waiting...")
#                     time.sleep(5)
#                     reconnect_attempts = 0
#                 logger.info(f"🔄 Reconnecting (attempt {reconnect_attempts + 1})...")
#                 with debug_lock(connection_lock):
#                     connection = connect_mavlink()
#                 reconnect_attempts += 1
#                 time.sleep(RECONNECT_DELAY)
#                 continue
#             msg = current_conn.recv_match(timeout=1)
#             # if msg:
#             #     print(msg)
#             if msg:
#                 handle_message(msg)
#                 reconnect_attempts = 0
#         except Exception as e:
#             logger.error(f"⚠️ Connection error: {e}")
#             with debug_lock(connection_lock):
#                 if connection:
#                     connection.close()
#                 connection = None
#             reconnect_attempts += 1
#             time.sleep(1)

def handle_messages():
    """Improved message handler with thread safety and robust reconnection"""
    global connection
    reconnect_attempts = 0
    count=0

    while True:
        try:
            # with debug_lock(connection_lock):
            current_conn = connection

            # If no active connection, attempt to reconnect
            if not current_conn:
                print("Debugging")
                if reconnect_attempts >= MAX_RECONNECT_ATTEMPTS:
                    logger.warning("⚠️ Max reconnection attempts reached, waiting...")
                    time.sleep(3)
                    reconnect_attempts = 0
                logger.info(f"🔄 Reconnecting (attempt {reconnect_attempts + 1})...")
                new_conn = connect_mavlink()
# Update global connection safely with lock
                with debug_lock(connection_lock):
                    connection = new_conn
                reconnect_attempts += 1
                time.sleep(RECONNECT_DELAY)
                continue

            # Process incoming MAVLink messages
            msg = current_conn.recv_match(timeout=1)
            if msg:
                # print("Received msg ",count)
                handle_message(msg)
                # count=count+1
                reconnect_attempts = 0  # Reset reconnect attempts on successful message   
        except ConnectionResetError as e:
            logger.error(f"⚠️ Connection reset: {e}")
            with debug_lock(connection_lock):
                if connection:
                    try:
                        connection.close()
                    except Exception as close_error:
                        logger.warning(f"Error while closing connection: {close_error}")
                connection = None
            reconnect_attempts += 1
            time.sleep(RECONNECT_DELAY)

        except ConnectionRefusedError as e:
            logger.error(f"⚠️ Connection refused: {e}")
            with debug_lock(connection_lock):
                connection = None
            reconnect_attempts += 1
            time.sleep(RECONNECT_DELAY)

        except AttributeError as e:
            logger.error(f"⚠️ AttributeError: {e}")
            with debug_lock(connection_lock):
                connection = None
            reconnect_attempts += 1
            time.sleep(RECONNECT_DELAY)

        except Exception as e:
            logger.error(f"⚠️ Unexpected error: {e}")
            with debug_lock(connection_lock):
                if connection:
                    try:
                        connection.close()
                    except Exception as close_error:
                        logger.warning(f"Error while closing connection: {close_error}")
                connection = None
            reconnect_attempts += 1
            time.sleep(RECONNECT_DELAY)
# def update_video_frames():
#     """Background thread to capture video frames"""
#     global frame_buffer
#     while video_active.is_set():
#         try:
#             if video_capture.get(cv2.CAP_PROP_BUFFERSIZE) != 1:
#                 video_capture.set(cv2.CAP_PROP_BUFFERSIZE, 1)
#             ret, frame = video_capture.read()
#             if ret:
#                 resized = cv2.resize(frame, (640, 480))
#                 _, jpeg = cv2.imencode('.jpg', resized, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
#                 with frame_lock:
#                     frame_buffer = jpeg.tobytes()
#             else:
#                 logger.warning("Video frame read failed, attempting reconnect...")
#                 reconnect_video()
#         except Exception as e:
#             logger.error(f"Video capture error: {e}")
#             reconnect_video()
#         time.sleep(0.03)

def reconnect_video():
    """Attempt to reconnect to video stream"""
    global video_capture
    max_attempts = 5
    for attempt in range(max_attempts):
        try:
            if video_capture:
                video_capture.release()
            video_capture = cv2.VideoCapture(os.getenv("VIDEO_STREAM_URL"))
            if video_capture.isOpened():
                logger.info("✅ Video reconnected")
                return True
        except Exception as e:
            logger.error(f"Reconnect attempt {attempt+1} failed: {e}")
        time.sleep(2)
    logger.error("❌ Maximum video reconnect attempts reached")
    return False

# @app.get("/video_stream")
# async def video_stream():
#     """MJPEG streaming endpoint for live video"""
#     async def generate_frames():
#         while True:
#             with frame_lock:
#                 if frame_buffer:
#                     yield (b'--frame\r\n'
#                            b'Content-Type: image/jpeg\r\n\r\n' + frame_buffer + b'\r\n')
#                 else:
#                     # Create error image with numpy
#                     error_image = np.zeros((480, 640, 3), dtype=np.uint8)
#                     cv2.putText(error_image, "NO VIDEO FEED", (50, 240), 
#                                cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
#                     _, jpeg = cv2.imencode('.jpg', error_image)
#                     yield (b'--frame\r\n'
#                            b'Content-Type: image/jpeg\r\n\r\n' + jpeg.tobytes() + b'\r\n')
#             await asyncio.sleep(0.03)
#     return StreamingResponse(generate_frames(), media_type="multipart/x-mixed-replace; boundary=frame")


def handle_message(msg):
    """Handle incoming MAVLink messages"""
    global mission_event, current_mission, latest_sensor_data,mission_ack_received
    msg_type = msg.get_type()
    # print("Msg type: ",msg_type)
    # print(msg)
    # if msg_type == 'STATUSTEXT':
    #         message = {
    #             # 'text': msg.text.decode('utf-8', errors='replace').strip('\x00'),
    #             'text': msg.text.strip('\x00'),
    #             'severity': msg.severity,
    #             'timestamp': datetime.now().isoformat()
    #         }
    #         latest_sensor_data.setdefault("status_messages", []).insert(0, message)
    #         latest_sensor_data["status_messages"] = latest_sensor_data["status_messages"][:20]
    #         logger.info(f"Status: [{message['severity']}] {message['text']}")
        
    with sensor_data_lock:
        # print("In handle message")
        if msg_type == 'STATUSTEXT':
            message = {
                # 'text': msg.text.decode('utf-8', errors='replace').strip('\x00'),
                'text': msg.text.strip('\x00'),
                'severity': msg.severity,
                'timestamp': datetime.now().isoformat()
            }
            latest_sensor_data.setdefault("status_messages", []).insert(0, message)
            latest_sensor_data["status_messages"] = latest_sensor_data["status_messages"][:20]
            logger.info(f"Status: [{message['severity']}] {message['text']}")
        elif msg_type == 'GLOBAL_POSITION_INT':
            latest_sensor_data.update({
                "altitude": msg.relative_alt / 1000,
                "ground_speed": math.sqrt(msg.vx**2 + msg.vy**2) / 100,
                "vertical_speed": msg.vz / 100,
                "heading": msg.hdg / 100,
                "latitude": msg.lat / 1e7,
                "longitude": msg.lon / 1e7,
            })
        elif msg_type == 'GPS_RAW_INT':
            latest_sensor_data["gps"] = {
                "fix_type": msg.fix_type,
                "satellites": msg.satellites_visible
            }
        elif msg_type == 'SYS_STATUS':
            latest_sensor_data.update({
                "battery_voltage": msg.voltage_battery / 1000 if msg.voltage_battery != 65535 else None,
                "battery_current": msg.current_battery / 100 if msg.current_battery != -1 else None,
                "battery_remaining": msg.battery_remaining if msg.battery_remaining != -1 else None,
            })
        elif msg_type == 'ATTITUDE':
            latest_sensor_data["yaw"] = math.degrees(msg.yaw) % 360
            latest_sensor_data["pitch"] = math.degrees(msg.pitch)
            latest_sensor_data["roll"] = math.degrees(msg.roll)
        elif msg_type == 'MAG_CAL_PROGRESS':
            # print(msg)
            # Initialize array if not present
            if "compass_calibration" not in latest_sensor_data:
                latest_sensor_data["compass_calibration"] = [
            {"compass_id": 0, "cal_status": 0, "completion_pct": 0, "direction_x": 0.0, "direction_y": 0.0, "direction_z": 0.0},
            {"compass_id": 1, "cal_status": 0, "completion_pct": 0, "direction_x": 0.0, "direction_y": 0.0, "direction_z": 0.0},
            {"compass_id": 2, "cal_status": 0, "completion_pct": 0, "direction_x": 0.0, "direction_y": 0.0, "direction_z": 0.0}
            ]
            # Update the specific compass entry by compass_id
            compass_id = msg.compass_id
            if 0 <= compass_id < 3:
                latest_sensor_data["compass_calibration"][compass_id] = {
            "compass_id": compass_id,
            "cal_status": msg.cal_status,
            "completion_pct": msg.completion_pct,
            "direction_x": msg.direction_x,
            "direction_y": msg.direction_y,
            "direction_z": msg.direction_z
            }
        elif msg_type == 'COMPASS_STATUS':
            print(msg)
            latest_sensor_data["compass"]["calibrated"] = (msg.cal_status == 3)
        # elif msg_type == 'HEARTBEAT':
        #     latest_sensor_data["arming"]["armed"] = (msg.base_mode & mavutil.mavlink.MAV_MODE_FLAG_SAFETY_ARMED) != 0
        elif msg_type == 'HEARTBEAT':
            if "arming" not in latest_sensor_data:
                latest_sensor_data["arming"] = {}
            latest_sensor_data["arming"]["armed"] = (msg.base_mode & mavutil.mavlink.MAV_MODE_FLAG_SAFETY_ARMED) != 0
            # Extract and store the current flight mode as a human-readable string
            try:
                mode_str = mavutil.mode_string_v10(msg)
            except Exception:
                mode_str = str(getattr(msg, 'custom_mode', 'UNKNOWN'))
            latest_sensor_data["mode"] = mode_str
        elif msg_type == 'RADIO_STATUS':
            # print(msg)
            latest_sensor_data["radio"] = {
                "rssi": msg.rssi,
                "remote_rssi": msg.remrssi,
                "noise": msg.noise,
                "remote_noise": msg.remnoise,
                "tx_buffer": msg.txbuf,
                # "packet_errors": msg.errors,
                "link_quality": int((msg.rssi + 120) / 1.2)
            }
        elif msg_type == 'COMMAND_ACK':
            if msg.command == mavutil.mavlink.MAV_CMD_PREFLIGHT_CALIBRATION:
                logger.info(f"Calibration command acknowledged: result {msg.result}")
        elif msg_type == 'RC_CHANNELS':
            # print(msg)
            latest_sensor_data["radio_sticks"] = {
                "roll": msg.chan1_raw,
                "pitch": msg.chan2_raw,
                "throttle": msg.chan3_raw,
                "yaw": msg.chan4_raw,
                "aux1": msg.chan5_raw,
                "aux2": msg.chan6_raw,
                "aux3": msg.chan7_raw,
                "aux4": msg.chan8_raw,
                "rssi": msg.rssi
            }
        elif msg_type == 'MISSION_ACK':
            logger.info(f"Mission upload acknowledged: {msg.type}")
            mission_ack_received = msg.type
            if msg.type == mavutil.mavlink.MAV_MISSION_ACCEPTED:  # Type 0
                logger.info("✅ Mission upload confirmed by the drone")
                mission_event.set()  # Signal success
            else:
                logger.error(f"Mission upload failed with error: {msg.type}")
                mission_event.set()  # Still trigger event to exit wait)
        elif msg_type=='MISSION_REQUEST': 
            seq = msg.seq
            logger.info(f"Drone requested mission item {seq}")
            if seq < len(current_mission):
                logger.info(f"Sending mission item {seq}")
                connection.mav.send(current_mission[seq])
            else:
                logger.error(f"Invalid mission item request: {seq}")
                                     
async def get_telemetry_snapshot():
    """Obtain a thread-safe copy of latest_sensor_data."""
    # Run lock and copy in thread to avoid blocking event loop
    def _snapshot():
        with sensor_data_lock:
            return latest_sensor_data.copy()
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _snapshot)

async def send_telemetry(websocket: WebSocket):
    """Send telemetry data over WebSocket"""
    last_telemetry = None
    connection_active = True
    last_connected=None
    count=0
    last_ping = time.time()


    try:
        # Start background listener
        # heartbeat_task = asyncio.create_task(receive_heartbeat())
        
        while connection_active:
            telemetry=await get_telemetry_snapshot()
            current_connected = connection is not None
            
            
            # Copy data quickly (atomic operation)
            # try:
            #     telemetry = latest_sensor_data.copy()
            # except RuntimeError:  # Handle dict modified during iteration
            #     continue
            # print("telemtry copied") 
            

            # Send with timeout protection
            try:
                if current_connected != last_connected:
                    await websocket.send_json({"type": "connection", "connected": current_connected})
                    last_connected = current_connected

                if telemetry != last_telemetry:
                    await websocket.send_json({"type": "telemetry", "data": telemetry}),
                    # await websocket.drain()
                    last_telemetry = telemetry
                    # print("Telemtry sent")
                    
            except (asyncio.TimeoutError, ConnectionResetError):
                logger.warning("Send timeout - client not responding")
                break

            await asyncio.sleep(0.2)
            # logger.info(f"Memory usage: {psutil.virtual_memory().percent}%")
            
            
    except WebSocketDisconnect:
        logger.info("Client disconnected normally")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        await websocket.close()
# # Setup Functions from Mission Planner
@app.post("/set_parameter/{param_id}/{value}")
async def set_parameter(param_id: str, value: float):
    """Set a specific parameter on the drone"""
    with debug_lock(connection_lock):
        if not connection:
            logger.warning("Attempt to set parameter with no connection")
            raise HTTPException(status_code=400, detail="No active connection")
        try:
            connection.param_set_send(param_id, value, mavutil.mavlink.MAV_PARAM_TYPE_REAL32)
            logger.info(f"Parameter {param_id} set to {value}")
            return {"message": f"Parameter {param_id} set to {value}"}
        except Exception as e:
            logger.error(f"Failed to set parameter {param_id}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to set parameter: {str(e)}")

@app.post("/set_frame_type/{frame_type}")
async def set_frame_type(frame_type: int):
    """Configure the drone's frame type"""
    with debug_lock(connection_lock):
        if not connection:
            logger.warning("Attempt to set frame type with no connection")
            raise HTTPException(status_code=400, detail="No active connection")
        try:
            connection.param_set_send("FRAME_TYPE", frame_type, mavutil.mavlink.MAV_PARAM_TYPE_UINT8)
            logger.info(f"Frame type set to {frame_type}")
            return {"message": f"Frame type configured to {frame_type}"}
        except Exception as e:
            logger.error(f"Frame type configuration failed: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to configure frame: {str(e)}")

@app.post("/set_initial_parameters")
async def set_initial_parameters(parameters: List[ParameterRequest]):
    """Set initial tuning parameters for the drone dynamically"""
    with debug_lock(connection_lock):
        if not connection:
            logger.warning("Attempt to set initial parameters with no connection")
            raise HTTPException(status_code=400, detail="No active connection")
        try:
            for parameter in parameters:
                connection.param_set_send(parameter.param, parameter.value, mavutil.mavlink.MAV_PARAM_TYPE_REAL32)
            logger.info("Initial parameters set")
            return {"message": "Initial parameters applied successfully"}
        except Exception as e:
            logger.error(f"Parameter setting failed: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to set parameters: {str(e)}")
        
@app.post("/set_flight_mode/{channel}/{mode_id}")
async def set_flight_mode(channel: int, mode_id: int):
    """Configure flight mode for a specific channel"""
    if channel < 1 or channel > 6:
        logger.error(f"Invalid flight mode channel: {channel}")
        raise HTTPException(status_code=400, detail="Channel must be between 1 and 6")
    with debug_lock(connection_lock):
        if not connection:
            logger.warning("Attempt to set flight mode with no connection")
            raise HTTPException(status_code=400, detail="No active connection")
        try:
            param_id = f"FLTMODE{channel}"
            connection.param_set_send(param_id, mode_id, mavutil.mavlink.MAV_PARAM_TYPE_UINT8)
            logger.info(f"Flight mode {param_id} set to {mode_id}")
            return {"message": f"Flight mode {param_id} set to {mode_id}"}
        except Exception as e:
            logger.error(f"Flight mode configuration failed: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to set flight mode: {str(e)}")

@app.post("/set_failsafe")
async def set_failsafe(settings: FailsafeSettings):
    """Configure failsafe settings"""
    with debug_lock(connection_lock):
        if not connection:
            logger.warning("Attempt to set failsafe with no connection")
            raise HTTPException(status_code=400, detail="No active connection")
        try:
            connection.param_set_send("FS_ACTION", settings.fs_action, mavutil.mavlink.MAV_PARAM_TYPE_UINT8)
            connection.param_set_send("FS_ALT", settings.fs_alt, mavutil.mavlink.MAV_PARAM_TYPE_REAL32)
            logger.info("Failsafe settings updated")
            return {"message": "Failsafe settings updated"}
        except Exception as e:
            logger.error(f"Failsafe configuration failed: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to set failsafe: {str(e)}")
        
@app.post("/calibrate_accelerometer")
async def calibrate_accelerometer():
    """Calibrate the drone's accelerometer"""
    with debug_lock(connection_lock):
        if not connection:
            logger.warning("Attempt to calibrate accelerometer with no connection")
            raise HTTPException(status_code=400, detail="No active connection")
        try:
            connection.mav.command_long_send(
    connection.target_system,          # Target system ID
    connection.target_component,       # Target component ID
    mavutil.mavlink.MAV_CMD_PREFLIGHT_CALIBRATION,  # Command ID for calibration
    0,                                 # Confirmation flag (0 for first transmission)
    0, 0, 0, 0,                        # param1: accelerometer calibration bitmask (2 means accelerometer)
    1,                                 # param5: accelerometer calibration flag
    0, 0                               # param6, param7: unused
)
            logger.info("Accelerometer calibration command sent")
            return {"message": "Accelerometer calibration initiated. Follow drone prompts."}
        except Exception as e:
            logger.error(f"Accelerometer calibration failed: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to calibrate accelerometer: {str(e)}")


@app.post("/accel_confirm_step")
async def confirm_calibration_step(request: AccelConfirmStepRequest):
    with debug_lock(connection_lock):
        if not connection:
            logger.warning("Attempt to confirm calibration step with no connection")
            raise HTTPException(status_code=400, detail="No active connection")
        try:
            # Send MAV_CMD_ACCELCAL_VEHICLE_POS with the provided vehiclePos
            connection.mav.command_long_send(
                connection.target_system,
                connection.target_component,
                mavutil.mavlink.MAV_CMD_ACCELCAL_VEHICLE_POS,
                0,  # Confirmation
                request.vehiclePos,  # param1: vehicle position
                0, 0, 0, 0, 0, 0  # Other params not used
            )
            logger.info(f"Calibration step confirmation sent with vehiclePos={request.vehiclePos}")
            return {"message": f"Calibration step confirmed for position {request.vehiclePos}"}
        except Exception as e:
            logger.error(f"Failed to confirm calibration step: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to confirm calibration step: {str(e)}")
               
@app.post("/calibrate_compass")
async def calibrate_compass():
    """Calibrate the drone's compass"""
    with debug_lock(connection_lock):
        if not connection:
            logger.warning("Attempt to calibrate compass with no connection")
            raise HTTPException(status_code=400, detail="No active connection")
        try:
            connection.mav.command_long_send(
                connection.target_system,
    connection.target_component,
    mavutil.mavlink.MAV_CMD_DO_START_MAG_CAL,  # Compass calibration
    0,  # Confirmation
    0,  # Automatically retry on failure
    1,  # Save automatically after success
    0,  # No retry on failure
    0, 0, 0, 0  # Reserved
)
#             connection.mav.command_long_send(
#                 connection.target_system,
#     connection.target_component,
#     mavutil.mavlink.MAV_CMD_PREFLIGHT_CALIBRATION,  # Compass calibration
#     0,  # Confirmation
#     0,  # Automatically retry on failure
#     0,  # Save automatically after success
#     0,  # No retry on failure
#     0, 0, 1, 0  # Reserved
# )
            logger.info("Compass calibration command sent")
            return {"message": "Compass calibration initiated. "}
        except Exception as e:
            logger.error(f"Compass calibration failed: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to calibrate compass: {str(e)}")


@app.post("/calibrate_accel_simple")
async def calibrate_accel_simple():
    """Calibrate the drone's accelerometer (simple accel calibration)"""
    with debug_lock(connection_lock):
        if not connection:
            logger.warning("Attempt to calibrate simple accel with no connection")
            raise HTTPException(status_code=400, detail="No active connection")
        try:
            connection.mav.command_long_send(
                connection.target_system,
                connection.target_component,
                mavutil.mavlink.MAV_CMD_PREFLIGHT_CALIBRATION,
                0,  # Confirmation
                0,  # param1: gyro
                0,  # param2: mag
                0,  # param3: ground pressure
                0,  # param4: radio
                4,  # param5: accelerometer (4 = simple accel calibration)
                0,  # param6: compmot/airspeed
                0   # param7: esc/baro
            )
            logger.info("Simple accelerometer calibration command sent")
            return {"message": "Simple accelerometer calibration command sent."}
        except Exception as e:
            logger.error(f"Simple accelerometer calibration failed: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to calibrate simple accelerometer: {str(e)}")
# --- ACCELEROMETER OFFSETS (BOARD LEVEL) CALIBRATION ENDPOINT ---
@app.post("/calibrate_accel_offsets")
async def calibrate_accel_offsets():
    """Calibrate the drone's accelerometer offsets (board level calibration)"""
    with debug_lock(connection_lock):
        if not connection:
            logger.warning("Attempt to calibrate accel offsets with no connection")
            raise HTTPException(status_code=400, detail="No active connection")
        try:
            connection.mav.command_long_send(
                connection.target_system,
                connection.target_component,
                mavutil.mavlink.MAV_CMD_PREFLIGHT_CALIBRATION,
                0,  # Confirmation
                0,  # param1: gyro
                0,  # param2: mag
                0,  # param3: ground pressure
                0,  # param4: radio
                2,  # param5: accelerometer (2 = board level calibration)
                0,  # param6: compmot/airspeed
                0   # param7: esc/baro
            )
            logger.info("Accelerometer offsets (board level) calibration command sent")
            return {"message": "Accelerometer offsets (board level) calibration command sent."}
        except Exception as e:
            logger.error(f"Accelerometer offsets calibration failed: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to calibrate accelerometer offsets: {str(e)}")


@app.post("/arm_drone")
async def arm_drone():
    """Arm the drone safely"""
    # with debug_lock(connection_lock):
    if not connection:
        logger.warning("Attempt to arm the drone with no connection")
        raise HTTPException(status_code=400, detail="No active connection")
    try:
        logger.info("Setting mode to Loiter...")
        connection.set_mode("LOITER")  # Set the mode to GUIDED
        logger.info("Arming the drone...")
        connection.arducopter_arm()  # Send the arming command
        try:
            await async_wait_for_arm(timeout=5)  # <-- SAFE WAIT
        except TimeoutError:
            raise HTTPException(status_code=500, detail="Failed to arm: Preflight checks failed or timeout")    
        logger.info("✅ Drone armed successfully!")
        return {"message": "Drone armed successfully!"}
    except Exception as e:
        logger.error(f"Failed to arm the drone: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to arm the drone: {str(e)}")

@app.post("/disarm_drone")
async def disarm_drone():
    """Disarm the drone safely"""
    with debug_lock(connection_lock):
        if not connection:
            logger.warning("Attempt to disarm the drone with no connection")
            raise HTTPException(status_code=400, detail="No active connection")
        try:
            logger.info("Disarming the drone...")
            connection.arducopter_disarm()  # Send the disarming command
            try:
                await async_wait_for_disarm(timeout=5)  # <-- Safe disarm wait
            except TimeoutError:
                raise HTTPException(status_code=500, detail="Failed to disarm: Timeout")  # Wait until the motors are disarmed
            logger.info("✅ Drone disarmed successfully!")
            return {"message": "Drone disarmed successfully!"}
        except Exception as e:
            logger.error(f"Failed to disarm the drone: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to disarm the drone: {str(e)}")

@app.post("/calibrate_radio")
async def calibrate_radio():
    """Calibrate the drone's radio control inputs"""
    with debug_lock(connection_lock):
        if not connection:
            logger.warning("Attempt to calibrate radio with no connection")
            raise HTTPException(status_code=400, detail="No active connection")
        try:
            connection.mav.command_long_send(
    connection.target_system,
    connection.target_component,
    mavutil.mavlink.MAV_CMD_PREFLIGHT_CALIBRATION,
    0,  # Confirmation flag
    0, 0, 0, 1,  # param1 = 4, indicates radio calibration
    0, 0, 0  # param5, param6, param7: unused
)
            logger.info("Radio calibration command sent")
            return {"message": "Radio calibration initiated. Move controls as instructed."}
        except Exception as e:
            logger.error(f"Radio calibration failed: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to calibrate radio: {str(e)}")

@app.post("/calibrate_esc")
async def calibrate_esc():
    """Calibrate the drone's ESCs"""
    with debug_lock(connection_lock):
        if not connection:
            logger.warning("Attempt to calibrate ESC with no connection")
            raise HTTPException(status_code=400, detail="No active connection")
        try:
            connection.mav.command_long_send(
                connection.target_system,
                connection.target_component,
                mavutil.mavlink.MAV_CMD_PREFLIGHT_CALIBRATION,
                0,
                0, 0, 0, 0, 0, 0, 1  # Bitmask for ESC calibration
            )
            logger.info("ESC calibration command sent")
            return {"message": "ESC calibration initiated. Follow power cycle instructions."}
        except Exception as e:
            logger.error(f"ESC calibration failed: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to calibrate ESC: {str(e)}")
        
# Existing Endpoints (unchanged but included for completeness)

# --- GET FLIGHT MODES ENDPOINT ---
@app.get("/get_flight_modes")
async def get_flight_modes():
    """Get current FLTMODE1-6 assignments and supported modes."""
    # with debug_lock(connection_lock):
    if not connection:
        raise HTTPException(status_code=400, detail="No active connection")
    try:
        mode_assignments = {}
        for i in range(1, 7):
            param_id = f"FLTMODE{i}"
            # Request parameter from the vehicle
            param = connection.param_fetch_one(param_id)
            # Wait up to 2 seconds for the parameter to be available in the cache
            value = None
            timeout = 2.0
            poll_interval = 0.05
            waited = 0.0
            while waited < timeout:
                value = connection.params.get(param_id)
                if value is not None:
                    break
                time.sleep(poll_interval)
                waited += poll_interval
            if value is not None:
                mode_assignments[param_id] = str(int(value))
            else:
                # Default to "0" (Stabilize) if not found
                mode_assignments[param_id] = "0"
        # Ensure supported_modes keys are strings for frontend compatibility
        supported_modes = {str(k): v for k, v in ARDUPILOT_FLIGHT_MODES.items()}
        return {
            "assignments": mode_assignments,
            "supported_modes": supported_modes
        }
    except Exception as e:
        logger.error(f"Failed to get flight modes: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get flight modes: {str(e)}")
@app.post("/preflight/checks", response_model=PreflightCheck)
def create_check(check: PreflightCheck):
    preflight_checks_db.append(check.dict())
    logger.info(f"Created new preflight check: {check.name}")
    return check

@app.get("/preflight/checks", response_model=List[PreflightCheck])
def list_checks():
    return preflight_checks_db

@app.post("/preflight/execute", response_model=List[PreflightCheckResult])
def execute_checks():
    global current_preflight_status, preflight_results_db
    current_preflight_status = PreflightStatus.IN_PROGRESS
    preflight_results_db = []
    logger.info("Starting preflight checks...")
    
    # Filter to only the required checks
    required_checks = [
        check for check in preflight_checks_db
        if check['name'] in ["Verify GPS", "Gps Sat Count", "Telemetry Signal", "Battery Level"]
    ]
    
    with sensor_data_lock:
        for check in required_checks:
            status = False
            message = "Check not implemented"
            if check['name'] == "Verify GPS":
                fix_type = latest_sensor_data.get("gps", {}).get("fix_type", 0)
                status = fix_type >= 3
                message = f"GPS {'OK' if status else 'FAIL'} - Fix: {fix_type}"
            elif check['name'] == "Gps Sat Count":
                satellites = latest_sensor_data.get("gps", {}).get("satellites", 0)
                status = satellites >= 6
                message = f"GPS Sat Count {'OK' if status else 'FAIL'} - Sats: {satellites}"
            elif check['name'] == "Telemetry Signal":
                link_quality = latest_sensor_data.get("radio", {}).get("link_quality", 0)
                status = link_quality > 60
                message = f"Telemetry Signal {'OK' if status else 'WEAK'} - Quality: {link_quality}%"
            elif check['name'] == "Battery Level":
                # voltage = latest_sensor_data.get("battery", {}).get("voltage", 0.0)
                # remaining = latest_sensor_data.get("battery", {}).get("remaining", 0)
                voltage = latest_sensor_data.get("battery_voltage", 0.0)
                remaining = latest_sensor_data.get("battery_remaining", 0.0)
                status = voltage >= 10.5 and remaining >= 20
                message = f"Battery {'OK' if status else 'LOW'} - {voltage}V, {remaining}%"
            
            result = PreflightCheckResult(
                check_id=check['id'],
                status=status,
                message=message,
                timestamp=datetime.now()
            )
            preflight_results_db.append(result.dict())
            logger.info(f"Preflight check '{check['name']}': {'PASS' if status else 'FAIL'} - {message}")
    
    if all(result['status'] for result in preflight_results_db):
        current_preflight_status = PreflightStatus.COMPLETED
        logger.info("✅ All preflight checks passed!")
    else:
        current_preflight_status = PreflightStatus.FAILED
        logger.warning("❌ Some preflight checks failed!")
    return preflight_results_db

@app.post("/preflight/confirm/{check_id}", response_model=PreflightCheckResult)
def confirm_manual(check_id: str):
    check = next((c for c in preflight_checks_db if c['id'] == check_id), None)
    if not check or check['check_type'] != CheckType.MANUAL:
        logger.error(f"Invalid manual check confirmation attempt for ID: {check_id}")
        raise HTTPException(status_code=400, detail="Invalid manual check")
    result = PreflightCheckResult(
        check_id=check_id,
        status=True,
        message="Manually confirmed by operator",
        timestamp=datetime.now()
    )
    preflight_results_db.append(result.dict())
    logger.info(f"Manually confirmed check: {check['name']}")
    return result

@app.get("/preflight/status", response_model=PreflightStatus)
def get_status():
    return current_preflight_status

@app.post("/configure_radio")
async def configure_radio(config: RadioConfig):
    """Send AT commands to SiK radio"""
    try:
        responses = []
        logger.info(f"Configuring radio on {config.port} at {config.baudrate} baud")
        with Serial(config.port, config.baudrate, timeout=1) as ser:
            for cmd in config.commands:
                ser.write(f"{cmd}\r\n".encode())
                await asyncio.sleep(0.2)
                response = ser.read_all().decode().strip()
                responses.append(response)
                logger.debug(f"Radio command '{cmd}' response: {response}")
        logger.info("Radio configuration complete")
        return {"responses": responses}
    except Exception as e:
        logger.error(f"Radio configuration failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/radio/configure/{preset}", response_model=Dict[str, str])
async def configure_radio_preset(preset: RadioPreset):
    """Apply predefined radio configuration"""
    if preset not in RADIO_PRESETS:
        logger.error(f"Invalid radio preset requested: {preset}")
        raise HTTPException(status_code=400, detail="Unknown preset")
    config = RadioConfig(
        port=os.getenv("RADIO_PORT", "/dev/ttyUSB0"),
        baudrate=DEFAULT_BAUD_RATE,
        commands=RADIO_PRESETS[preset]["commands"]
    )
    logger.info(f"Applying {preset} radio configuration")
    return await configure_radio(config)

@app.get("/connection/status")
async def get_connection_status():
    """Check current connection health"""
    with debug_lock(connection_lock):
        if not connection:
            logger.warning("Connection status check: No active connection")
            return {"status": "disconnected", "details": "No active connection"}
        return {
            "status": "connected",
            "type": str(connection.connection_type),
            "target_system": connection.target_system,
            "radio_link": latest_sensor_data.get("radio", {}),
            "last_heartbeat": connection.last_heartbeat,
            "messages_received": connection.messages_received,
            "message_loss": connection.packet_loss()
        }

@app.post("/connection/reconnect")
async def force_reconnect():
    """Force a reconnection attempt"""
    global connection
    logger.info("Forcing reconnection...")
    with debug_lock(connection_lock):
        if connection:
            connection.close()
        connection = connect_mavlink()
    return {"message": "Reconnection attempt initiated"}

@app.post("/generate_polygon_mission")
async def generate_polygon_mission(polygon: List[Dict], altitude: float, overlap: float = 0.3):
    if len(polygon) != 4:
        logger.error("Polygon mission generation failed: Must have exactly 4 points")
        return {"error": "Polygon must have exactly 4 points."}
    try:
        logger.info("Generating lawnmower pattern mission")
        waypoints = generate_lawnmower_pattern(polygon, altitude, overlap)
        return await start_mission(waypoints)
    except Exception as e:
        logger.error(f"Mission generation failed: {e}")
        return {"error": f"Mission generation failed: {str(e)}"}

def generate_lawnmower_pattern(polygon_points, altitude, overlap, sensor_width_mm=6.17, focal_length_mm=24):
    utm_points = []
    zones = set()
    for p in polygon_points:
        lat = p['lat']
        lon = p['lon']
        easting, northing, zone_number, zone_letter = utm.from_latlon(lat, lon)
        utm_points.append((easting, northing))
        zones.add((zone_number, zone_letter))
    if len(zones) > 1:
        raise ValueError("Polygon spans multiple UTM zones")
    zone = zones.pop()
    poly_shapely = Polygon(utm_points)
    if not poly_shapely.is_valid:
        raise ValueError("Invalid polygon geometry")
    hull = ConvexHull(utm_points)
    hull_points = [utm_points[i] for i in hull.vertices]
    min_area = float('inf')
    best_angle = 0
    best_p1 = (0, 0)
    best_rotated_bounds = (0, 0, 0, 0)
    for i in range(len(hull_points)):
        p1 = hull_points[i]
        p2 = hull_points[(i + 1) % len(hull_points)]
        dx = p2[0] - p1[0]
        dy = p2[1] - p1[1]
        edge_angle = math.atan2(dy, dx)
        cos_theta = math.cos(-edge_angle)
        sin_theta = math.sin(-edge_angle)
        rotated_points = [
            (
                (p[0] - p1[0]) * cos_theta - (p[1] - p1[1]) * sin_theta,
                (p[0] - p1[0]) * sin_theta + (p[1] - p1[1]) * cos_theta
            ) for p in utm_points
        ]
        min_x = min(p[0] for p in rotated_points)
        max_x = max(p[0] for p in rotated_points)
        min_y = min(p[1] for p in rotated_points)
        max_y = max(p[1] for p in rotated_points)
        area = (max_x - min_x) * (max_y - min_y)
        if area < min_area:
            min_area = area
            best_angle = edge_angle
            best_p1 = p1
            best_rotated_bounds = (min_x, max_x, min_y, max_y)
    footprint_width = (sensor_width_mm * altitude) / (focal_length_mm * 1000)
    spacing = footprint_width * (1 - overlap)
    transect_lines_rot = []
    current_y = best_rotated_bounds[2]
    direction = 1
    while current_y <= best_rotated_bounds[3]:
        if direction == 1:
            start_x, end_x = best_rotated_bounds[0], best_rotated_bounds[1]
        else:
            start_x, end_x = best_rotated_bounds[1], best_rotated_bounds[0]
        transect_lines_rot.append(((start_x, current_y), (end_x, current_y)))
        current_y += spacing
        direction *= -1
    waypoints_utm = []
    cos_theta = math.cos(best_angle)
    sin_theta = math.sin(best_angle)
    for line in transect_lines_rot:
        (start_x_rot, start_y_rot), (end_x_rot, end_y_rot) = line
        start_x = start_x_rot * cos_theta - start_y_rot * sin_theta + best_p1[0]
        start_y = start_x_rot * sin_theta + start_y_rot * cos_theta + best_p1[1]
        end_x = end_x_rot * cos_theta - end_y_rot * sin_theta + best_p1[0]
        end_y = end_x_rot * sin_theta + end_y_rot * cos_theta + best_p1[1]
        transect_line = LineString([(start_x, start_y), (end_x, end_y)])
        intersection = transect_line.intersection(poly_shapely)
        if not intersection.is_empty:
            if intersection.geom_type == 'LineString':
                waypoints_utm.extend(intersection.coords)
            elif intersection.geom_type == 'MultiLineString':
                for part in intersection.geoms:
                    waypoints_utm.extend(part.coords)
    waypoints = []
    for easting, northing in waypoints_utm:
        lat, lon = utm.to_latlon(easting, northing, zone[0], zone[1])
        waypoints.append({"lat": lat, "lon": lon, "alt": altitude})
    return {"waypoints": waypoints}

# def upload_mission(waypoints):
#     global connection, current_mission, mission_event
#     try:
#         with debug_lock(connection_lock):
#             if not connection:
#                 raise ConnectionError("No active connection")
#             # logger.info("Clearing existing mission...")
#             # connection.waypoint_clear_all_send()
#             current_mission = []
#             logger.info(f"Preparing {len(waypoints)} mission items...")
#             for idx, wp in enumerate(waypoints):
#                 mission_item = connection.mav.mission_item_int_encode(
#                     connection.target_system,
#                     connection.target_component,
#                     idx,
#                     mavutil.mavlink.MAV_FRAME_GLOBAL_RELATIVE_ALT_INT,
#                     mavutil.mavlink.MAV_CMD_NAV_WAYPOINT,
#                     0,  # Current (0 for no, 1 for yes)
#                     1,  # Autocontinue
#                     0,  # Hold time (sec)
#                     2,  # Acceptance radius (meters)
#                     0,  # Pass through (0)
#                     0,  # Yaw (degrees, NaN for none)
#                     int(wp["lat"] * 1e7),
#                     int(wp["lon"] * 1e7),
#                     int(wp["alt"])
#                 )
#                 current_mission.append(mission_item)
#             print(current_mission)
#             print(len(current_mission))
#             logger.info("Sending mission count...")
#             connection.mav.mission_count_send(
#                 connection.target_system,
#                 connection.target_component,
#                 len(current_mission)
#             )
#             mission_event.clear()
#             logger.info("Waiting for mission upload confirmation...")
#             if not mission_event.wait(timeout=30):
#                 raise TimeoutError("Mission upload timed out")
#             logger.info("Setting mode to AUTO ...")
#             connection.set_mode("AUTO")
#             logger.info("Starting mission...")
#             connection.mav.command_long_send(
#                 connection.target_system,
#                 connection.target_component,
#                 mavutil.mavlink.MAV_CMD_MISSION_START,
#                 0, 0, 0, 0, 0, 0, 0, 0
#             )
#             logger.info("Mission started successfully!")
#             return {"message": "Mission started successfully!"}
#     except Exception as e:
#         logger.error(f"Mission upload failed: {e}")
#         return {"error": f"Mission failed: {str(e)}"}

def upload_mission(waypoints):
    global connection, current_mission, mission_event,mission_ack_received
    try:
        with debug_lock(connection_lock):
            if not connection:
                raise ConnectionError("No active connection")
            logger.info("Clearing existing mission...")
            connection.waypoint_clear_all_send()
            mission_event.clear()
            mission_ack_received = None
        logger.info("Waiting for mission clear confirmation...")
        if not mission_event.wait(timeout=10):
            raise TimeoutError("Mission clear timed out")
        if mission_ack_received != 0:
            raise ConnectionError(f"Mission clear failed: {mission_ack_received}")
        
        with debug_lock(connection_lock):
            current_mission = []
            # Prepare mission items
            for idx, wp in enumerate(waypoints):
                mission_item = connection.mav.mission_item_int_encode(
                    connection.target_system,
                    connection.target_component,
                    idx,
                    mavutil.mavlink.MAV_FRAME_GLOBAL_RELATIVE_ALT_INT,
                    mavutil.mavlink.MAV_CMD_NAV_WAYPOINT,  # Critical fix: Use WAYPOINT_INT
                    0,  # Current waypoint (0 for no)
                    1,  # Autocontinue
                    0,  # Hold time (seconds)
                    2,  # Acceptance radius (meters) - Set to 2m
                    0,  # Pass-through (0 for no)
                    float('nan'),  # Yaw angle (degrees, NaN for no change)
                    int(wp["lat"] * 1e7),
                    int(wp["lon"] * 1e7),
                    int(wp["alt"])
                )
                current_mission.append(mission_item)
            logger.info("Sending mission count...")
            connection.mav.mission_count_send(
                connection.target_system,
                connection.target_component,
                len(current_mission)
            )
            mission_event.clear()
            mission_ack_received = None  # Reset to track upload-specific ack
        
        # Release lock and wait for upload confirmation
        logger.info("Waiting for mission upload confirmation...")
        if not mission_event.wait(timeout=30):
            raise TimeoutError("Mission upload timed out")
        # if mission_ack_received != 0:  # Check if ACK was successful
        #     raise ConnectionError(f"Mission upload failed: {mission_ack_received}")
        
        # Re-acquire lock for arming and mode change
        with debug_lock(connection_lock):
            # Arm the drone
            logger.info("Arming drone...")
            connection.mav.command_long_send(
                connection.target_system,
                connection.target_component,
                mavutil.mavlink.MAV_CMD_COMPONENT_ARM_DISARM,
                0, 1, 0, 0, 0, 0, 0, 0  # Arm command
            )
            time.sleep(2)  # Wait for arming (check HEARTBEAT.armed in real code)
            
            # Set mode to AUTO
            logger.info("Setting mode to AUTO...")
            auto_mode = connection.mode_mapping()["AUTO"]
            connection.set_mode(
                connection.target_system,
                mavutil.mavlink.MAV_MODE_FLAG_CUSTOM_MODE_ENABLED,
                auto_mode
            )
            time.sleep(1)  # Wait for mode change
            logger.info("Starting mission...")
            
            # Start mission
            connection.mav.command_long_send(
                connection.target_system,
                connection.target_component,
                mavutil.mavlink.MAV_CMD_MISSION_START,
                0, 0, 0, 0, 0, 0, 0, 0
            )
        
        logger.info("Mission started successfully!")
        return {"message": "Mission started successfully!"}
    except Exception as e:
        logger.error(f"Mission upload failed: {e}")
        return {"error": f"Mission failed: {str(e)}"}


@app.post("/start_mission")
async def start_mission(waypoints: List[Dict]):
    logger.info("Starting mission...")
    return await asyncio.to_thread(upload_mission, waypoints)


@app.post("/fly_here")
async def fly_here(request: FlyHereRequest):
    with debug_lock(connection_lock):
        if not connection:
            logger.warning("Attempt to navigate with no connection")
            raise HTTPException(status_code=400, detail="No active connection")
        try:
            # connection.set_mode("GUIDED")  # Set the mode to GUIDED
            # logger.info("Mode set to GUIDED")
            # connection.arducopter_arm()
            # logger.info("✅ Drone Armed!")
            # connection.motors_armed_wait()
            # logger.info("🔒 Motors armed")
            logger.info(f"Navigating to coordinates: {request.lat}, {request.lon} at {request.alt}m")
            connection.mav.set_position_target_global_int_send(
                int(1e3 * (time.time() - boot_time)),
                connection.target_system,
                connection.target_component,
                mavutil.mavlink.MAV_FRAME_GLOBAL_RELATIVE_ALT_INT,
                0b1111111111111000,
                int(request.lat * 1e7),
                int(request.lon * 1e7),
                request.alt,
                0, 0, 0,
                0, 0, 0,
                0, 0
            )
            logger.info("Navigation command sent successfully")
            return {"message": "Navigating to specified coordinates!"}
        except Exception as e:
            logger.error(f"Navigation failed: {e}")
            raise HTTPException(status_code=500, detail=f"Navigation failed: {str(e)}")
        
@app.post("/takeoff/{altitude}")
async def takeoff(altitude: float):
   
    with debug_lock(connection_lock):
        if not connection:
            logger.warning("Attempt to takeoff with no connection")
            raise HTTPException(status_code=400, detail="No active connection")
        try:
            connection.set_mode("GUIDED")  # Or: connection.set_mode("GUIDED")
            logger.info("Mode set to GUIDED")
            logger.info(f"Arming drone for takeoff to {altitude}m...")
            connection.arducopter_arm()
            logger.info("✅ Drone Armed!")
            try:
                await async_wait_for_arm(timeout=5)# <-- SAFE WAIT
            except TimeoutError:
                raise HTTPException(status_code=500, detail="Failed to arm: Preflight checks failed or timeout")
            connection.mav.command_long_send(
                connection.target_system,
                connection.target_component,
                mavutil.mavlink.MAV_CMD_NAV_TAKEOFF,
                0,
                0, 0, 0, 0, 0, 0, altitude
            )
            logger.info(f"🛫 Takeoff Command Sent: Altitude {altitude}m")
            return {"message": f"Takeoff initiated to {altitude}m!"}
        except Exception as e:
            logger.error(f"Takeoff failed: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to take off: {str(e)}")

@app.post("/change_altitude/{altitude}")
async def change_altitude(altitude: float):
    with debug_lock(connection_lock):
        if not connection:
            logger.warning("Attempt to change altitude with no connection")
            raise HTTPException(status_code=400, detail="No active connection")
        try:
            logger.info(f"Changing altitude to {altitude}m...")
            connection.mav.command_long_send(
                connection.target_system,
                connection.target_component,
                mavutil.mavlink.MAV_CMD_CONDITION_CHANGE_ALT,
                0,
                altitude, 0, 0, 0, 0, 0, 0
            )
            logger.info(f"📡 Altitude Change Command Sent: New Altitude {altitude}m")
            return {"message": f"Altitude changing to {altitude}m!"}
        except Exception as e:
            logger.error(f"Altitude change failed: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to change altitude: {str(e)}")

@app.post("/land")
async def land():
    with debug_lock(connection_lock):
        if not connection:
            logger.warning("Attempt to land with no connection")
            raise HTTPException(status_code=400, detail="No active connection")
        try:
            logger.info("Initiating landing...")
            connection.mav.command_long_send(
                connection.target_system,
                connection.target_component,
                mavutil.mavlink.MAV_CMD_NAV_LAND,
                0,
                0, 0, 0, 0, 0, 0, 0
            )
            logger.info("🛬 Landing Command Sent!")
            return {"message": "Landing initiated!"}
        except Exception as e:
            logger.error(f"Landing failed: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to land: {str(e)}")
# @app.get("/health")
# async def health_check():
#     return {"status": "ok", "connections": len(connection_state["websocket_clients"])}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint to handle MAVLink connection and telemetry streaming"""
    print("In websocket")
    global connection_state
    connection_state["websocket_clients"].add(websocket)
    global connection, connection_params

    # Extract query parameters
    query_params = websocket.query_params
    connection_params["comPort"] = query_params.get("comPort")
    connection_params["baudRate"] = int(query_params.get("baudRate", DEFAULT_BAUD_RATE))

    # Accept the WebSocket connection
    await websocket.accept()
    logger.info(f"WebSocket connected with comPort={connection_params['comPort']}, baudRate={connection_params['baudRate']}")

    try:
        # Simply send telemetry using the global connection
        await send_telemetry(websocket)
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        # Ensure the WebSocket is not already closed
        connection_state["websocket_clients"].discard(websocket)
        connection_state["last_activity"] = time.time()
        if websocket.application_state != "CLOSED":
            try:
                await websocket.close()
            except RuntimeError as e:
                logger.warning(f"WebSocket already closed: {e}")
                logger.info("WebSocket connection closed")

            except WebSocketDisconnect:
                logger.info("❌ WebSocket disconnected")
            except Exception as e:
                logger.error(f"WebSocket error: {e}")
                await websocket.close()
            finally:
            # Clean up connection on WebSocket close
                with debug_lock(connection_lock):
                    if connection:
                        connection.close()
                        connection = None
                
@app.get("/heartbeat")
async def send_heartbeat():
    with debug_lock(connection_lock):
        if not connection:
            logger.warning("Attempt to send heartbeat with no connection")
            raise HTTPException(status_code=400, detail="No active connection")
        try:
            logger.debug("Sending heartbeat...")
            connection.mav.heartbeat_send(
                type=1,
                autopilot=6,
                base_mode=0,
                custom_mode=0,
                system_status=0
            )
            return {"message": "Heartbeat sent!"}
        except Exception as e:
            logger.error(f"Heartbeat failed: {e}")
            raise HTTPException(status_code=500, detail=f"Heartbeat failed: {str(e)}")

@app.post("/returntohome")
async def returntohome():
    with debug_lock(connection_lock):
        if not connection:
            logger.warning("Attempt to RTL with no connection")
            raise HTTPException(status_code=400, detail="No active connection")
        try:
            logger.info("Initiating return to launch...")
            connection.mav.command_long_send(
                connection.target_system,
                connection.target_component,
                mavutil.mavlink.MAV_CMD_NAV_RETURN_TO_LAUNCH,
                0,
                0, 0, 0, 0, 0, 0, 0
            )
            logger.info("🏠 Return to Home Command Sent!")
            return {"message": "Returning to launch location!"}
        except Exception as e:
            logger.error(f"RTL failed: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to return home: {str(e)}")




@app.post("/end_mission")
async def end_mission():
    with debug_lock(connection_lock):
        if not connection:
            logger.warning("Attempt to end mission with no connection")
            raise HTTPException(status_code=400, detail="No active connection")
        try:
            logger.info("Ending mission and switching to LOITER mode...")
            connection.set_mode("LOITER")
            connection.mav.command_long_send(
                connection.target_system,
                connection.target_component,
                mavutil.mavlink.MAV_CMD_MISSION_STOP,
                0,
                0, 0, 0, 0, 0, 0, 0
            )
            logger.info("✅ Mission stopped and mode changed to LOITER")
            return {"message": "Mission ended and mode set to LOITER"}
        except Exception as e:
            logger.error(f"Failed to end mission: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to end mission: {str(e)}")




# Initialize default checks at startup
default_checks = [
    PreflightCheck(
        id="verify_gps",
        name="Verify GPS",
        description="Check GPS fix type",
        check_type=CheckType.AUTOMATED,
        severity=CheckSeverity.CRITICAL
    ),
    PreflightCheck(
        id="gps_sat_count",
        name="Gps Sat Count",
        description="Check number of GPS satellites",
        check_type=CheckType.AUTOMATED,
        severity=CheckSeverity.CRITICAL
    ),
    # PreflightCheck(
    #     id="telemetry_signal",
    #     name="Telemetry Signal",
    #     description="Check telemetry signal strength",
    #     check_type=CheckType.AUTOMATED,
    #     severity=CheckSeverity.CRITICAL
    # ),
    PreflightCheck(
        id="battery_level",
        name="Battery Level",
        description="Check battery voltage and remaining capacity",
        check_type=CheckType.AUTOMATED,
        severity=CheckSeverity.CRITICAL
    )
]

# Initialize preflight_checks_db with these checks
preflight_checks_db.clear()  # Clear any existing checks


preflight_checks_db.extend([check.dict() for check in default_checks])

if __name__ == "__main__":
    import asyncio
    from hypercorn.config import Config
    from hypercorn.asyncio import serve
    from final import app  # Ensure 'final.py' contains your FastAPI app instance named 'app'

    config = Config()
    config.bind = ["0.0.0.0:8000"]
    config.reload = True
    # config.keep_alive_timeout = 30
    config.keep_alive_timeout = 60       # HTTP keep‑alive (not WS)
    config.websocket_ping_interval = 60
    config.loglevel = "info"
    config.worker_class = "asyncio"  # Options: 'asyncio', 'uvloop', 'trio'
    config.ws_max_size = 16777216  # 16MB, adjust as needed

    asyncio.run(serve(app, config))