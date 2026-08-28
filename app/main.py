from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.config import get_settings
from app.services.recommender import warm_cache


@asynccontextmanager
async def lifespan(app: FastAPI):
    warm_cache()  # fit the KNN models at startup instead of on first request
    yield


app = FastAPI(title="Music Recommender API", lifespan=lifespan)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(router)
