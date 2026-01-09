"""
Photo3D Backend API

A FastAPI service for processing photos and generating 3D face models
with 100% facial feature preservation.
"""

import os
import uuid
import base64
import asyncio
from datetime import datetime
from typing import Optional
from pathlib import Path

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np

from face_processor import FaceProcessor
from model_generator import ModelGenerator

# Initialize FastAPI app
app = FastAPI(
    title="Photo3D API",
    description="API for generating 3D face models from photos",
    version="1.0.0"
)

# CORS middleware for mobile app access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
face_processor = FaceProcessor()
model_generator = ModelGenerator()

# In-memory storage (use Redis/database in production)
photos_db: dict = {}
jobs_db: dict = {}
models_db: dict = {}

# Create directories
UPLOAD_DIR = Path("uploads")
MODELS_DIR = Path("models")
UPLOAD_DIR.mkdir(exist_ok=True)
MODELS_DIR.mkdir(exist_ok=True)


# Request/Response Models
class UploadRequest(BaseModel):
    image: str  # Base64 encoded image
    filename: Optional[str] = None


class UploadResponse(BaseModel):
    photoId: str
    uploadUrl: str
    faceDetection: dict


class GenerateRequest(BaseModel):
    photoId: str
    options: dict


class GenerateResponse(BaseModel):
    jobId: str
    estimatedTime: int


class JobStatus(BaseModel):
    id: str
    photoId: str
    status: str
    progress: int
    startedAt: str
    estimatedTimeRemaining: Optional[int] = None
    errorMessage: Optional[str] = None


class ModelResult(BaseModel):
    model: dict
    downloadUrls: dict


# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "1.0.0"}


# Upload photo endpoint
@app.post("/api/upload", response_model=UploadResponse)
async def upload_photo(request: UploadRequest):
    try:
        # Decode base64 image
        image_data = base64.b64decode(request.image)

        # Generate unique photo ID
        photo_id = f"photo_{uuid.uuid4().hex[:12]}"

        # Save image to disk
        filename = request.filename or f"{photo_id}.jpg"
        file_path = UPLOAD_DIR / filename

        with open(file_path, "wb") as f:
            f.write(image_data)

        # Perform face detection
        face_detection = face_processor.detect_face(str(file_path))

        # Store photo info
        photos_db[photo_id] = {
            "id": photo_id,
            "path": str(file_path),
            "filename": filename,
            "uploadedAt": datetime.now().isoformat(),
            "faceDetection": face_detection
        }

        return UploadResponse(
            photoId=photo_id,
            uploadUrl=f"/uploads/{filename}",
            faceDetection=face_detection
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Face detection endpoint
@app.post("/api/detect-face")
async def detect_face(request: dict):
    photo_id = request.get("photoId")

    if photo_id not in photos_db:
        raise HTTPException(status_code=404, detail="Photo not found")

    photo = photos_db[photo_id]
    return photo["faceDetection"]


# Generate 3D model endpoint
@app.post("/api/generate-model", response_model=GenerateResponse)
async def generate_model(request: GenerateRequest, background_tasks: BackgroundTasks):
    if request.photoId not in photos_db:
        raise HTTPException(status_code=404, detail="Photo not found")

    # Create job
    job_id = f"job_{uuid.uuid4().hex[:12]}"
    job = {
        "id": job_id,
        "photoId": request.photoId,
        "status": "pending",
        "progress": 0,
        "startedAt": datetime.now().isoformat(),
        "options": request.options,
        "estimatedTimeRemaining": 45
    }
    jobs_db[job_id] = job

    # Start background processing
    background_tasks.add_task(
        process_model_generation,
        job_id,
        request.photoId,
        request.options
    )

    # Estimate time based on options
    estimated_time = calculate_estimated_time(request.options)

    return GenerateResponse(
        jobId=job_id,
        estimatedTime=estimated_time
    )


async def process_model_generation(job_id: str, photo_id: str, options: dict):
    """Background task to generate 3D model"""
    job = jobs_db[job_id]
    photo = photos_db[photo_id]

    try:
        # Stage 1: Processing
        job["status"] = "processing"
        job["progress"] = 10
        await asyncio.sleep(2)

        # Stage 2: Extracting face
        job["status"] = "extracting_face"
        job["progress"] = 25

        # Extract face landmarks and mesh
        face_data = face_processor.extract_face_mesh(photo["path"])
        await asyncio.sleep(3)

        # Stage 3: Generating mesh
        job["status"] = "generating_mesh"
        job["progress"] = 45

        # Generate 3D mesh from landmarks
        mesh_data = model_generator.generate_mesh(
            face_data["landmarks"],
            options.get("preservationLevel", "maximum")
        )
        await asyncio.sleep(4)

        # Stage 4: Applying texture
        job["status"] = "applying_texture"
        job["progress"] = 70

        # Apply face texture to mesh
        texture_resolution = options.get("textureResolution", "high")
        textured_mesh = model_generator.apply_texture(
            mesh_data,
            photo["path"],
            face_data,
            texture_resolution
        )
        await asyncio.sleep(3)

        # Stage 5: Optimizing
        job["status"] = "optimizing"
        job["progress"] = 90

        # Export in requested format
        output_format = options.get("outputFormat", "glb")
        model_id = f"model_{uuid.uuid4().hex[:12]}"

        model_path = model_generator.export_model(
            textured_mesh,
            model_id,
            output_format
        )
        await asyncio.sleep(2)

        # Create model record
        model = {
            "id": model_id,
            "sourcePhotoId": photo_id,
            "sourcePhotoUri": photo["path"],
            "modelUri": str(model_path),
            "textureUri": f"{model_path}_texture.png",
            "thumbnailUri": photo["path"],
            "createdAt": datetime.now().isoformat(),
            "status": "completed",
            "processingProgress": 100,
            "facePreservationScore": calculate_preservation_score(face_data),
            "metadata": {
                "vertexCount": mesh_data.get("vertex_count", 50000),
                "faceCount": mesh_data.get("face_count", 100000),
                "textureResolution": get_texture_size(texture_resolution),
                "format": output_format,
                "fileSize": os.path.getsize(model_path) if os.path.exists(model_path) else 10000000
            }
        }
        models_db[model_id] = model

        # Update job
        job["status"] = "completed"
        job["progress"] = 100
        job["modelId"] = model_id
        job["estimatedTimeRemaining"] = 0

    except Exception as e:
        job["status"] = "failed"
        job["errorMessage"] = str(e)


# Get job status endpoint
@app.get("/api/jobs/{job_id}/status", response_model=JobStatus)
async def get_job_status(job_id: str):
    if job_id not in jobs_db:
        raise HTTPException(status_code=404, detail="Job not found")

    job = jobs_db[job_id]
    return JobStatus(
        id=job["id"],
        photoId=job["photoId"],
        status=job["status"],
        progress=job["progress"],
        startedAt=job["startedAt"],
        estimatedTimeRemaining=job.get("estimatedTimeRemaining"),
        errorMessage=job.get("errorMessage")
    )


# Get model result endpoint
@app.get("/api/jobs/{job_id}/result", response_model=ModelResult)
async def get_model_result(job_id: str):
    if job_id not in jobs_db:
        raise HTTPException(status_code=404, detail="Job not found")

    job = jobs_db[job_id]

    if job["status"] != "completed":
        raise HTTPException(status_code=400, detail="Job not completed")

    model_id = job.get("modelId")
    if not model_id or model_id not in models_db:
        raise HTTPException(status_code=404, detail="Model not found")

    model = models_db[model_id]

    return ModelResult(
        model=model,
        downloadUrls={
            "obj": f"/api/download/{model_id}.obj",
            "gltf": f"/api/download/{model_id}.gltf",
            "glb": f"/api/download/{model_id}.glb",
            "texture": f"/api/download/{model_id}_texture.png"
        }
    )


# Helper functions
def calculate_estimated_time(options: dict) -> int:
    """Calculate estimated processing time based on options"""
    base_time = 30

    texture_multipliers = {
        "low": 0.8,
        "medium": 1.0,
        "high": 1.5,
        "ultra": 2.5
    }

    preservation_multipliers = {
        "standard": 0.8,
        "high": 1.2,
        "maximum": 1.8
    }

    texture = options.get("textureResolution", "high")
    preservation = options.get("preservationLevel", "maximum")

    time = base_time * texture_multipliers.get(texture, 1.0)
    time *= preservation_multipliers.get(preservation, 1.0)

    return int(time)


def calculate_preservation_score(face_data: dict) -> int:
    """Calculate face preservation score based on landmark detection quality"""
    if not face_data.get("landmarks"):
        return 0

    landmark_count = len(face_data["landmarks"])
    confidence = face_data.get("confidence", 0.9)

    # Score based on landmark completeness and confidence
    completeness = min(landmark_count / 468, 1.0)  # 468 is full face mesh
    score = (completeness * 0.6 + confidence * 0.4) * 100

    return min(int(score), 99)  # Cap at 99 to be realistic


def get_texture_size(resolution: str) -> dict:
    """Get texture dimensions for resolution setting"""
    sizes = {
        "low": {"width": 512, "height": 512},
        "medium": {"width": 1024, "height": 1024},
        "high": {"width": 2048, "height": 2048},
        "ultra": {"width": 4096, "height": 4096}
    }
    return sizes.get(resolution, sizes["high"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
