from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import router
from app.core.config import get_settings
from app.core.response import error_response
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


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTPException and convert to standardized error response."""
    endpoint = f"{request.url.path}"
    if request.url.query:
        endpoint = f"{endpoint}?{request.url.query}"

    error = error_response(
        endpoint=endpoint,
        mcp_tool="api_error",
        code=exc.status_code,
        message=exc.detail or "Erro na requisição",
        recommendation=None,
    )

    return JSONResponse(
        status_code=exc.status_code,
        content=error.model_dump(),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors and return standardized JSON response."""
    endpoint = f"{request.url.path}"
    if request.url.query:
        endpoint = f"{endpoint}?{request.url.query}"

    details = exc.errors()
    first_error = details[0] if details else {}
    location = first_error.get("loc", [])
    field_name = location[-1] if location else "campo"
    message = "Dados de entrada inválidos."

    if field_name == "by":
        message = "Parâmetro 'by' inválido. Use 'song' ou 'artist'."
    elif field_name == "limit":
        message = "Parâmetro 'limit' inválido. Use um valor entre 1 e 100."
    elif field_name == "q":
        message = "Parâmetro 'q' inválido. Informe um termo de busca válido."

    error = error_response(
        endpoint=endpoint,
        mcp_tool="api_error",
        code=422,
        message=message,
        recommendation="Revise os parâmetros da requisição e tente novamente.",
    )

    return JSONResponse(
        status_code=422,
        content=error.model_dump(),
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected errors and convert to standardized error response."""
    endpoint = f"{request.url.path}"
    if request.url.query:
        endpoint = f"{endpoint}?{request.url.query}"
    
    error = error_response(
        endpoint=endpoint,
        mcp_tool="api_error",
        code=500,
        message="Erro interno do servidor. Tente novamente mais tarde.",
        recommendation="Se o problema persistir, contate o suporte.",
    )
    
    return JSONResponse(
        status_code=500,
        content=error.model_dump(),
    )
