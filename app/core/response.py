"""Helper functions for standardized API responses."""

from datetime import datetime
from fastapi import Request

from app.models import ErrorDetail, ErrorPayload, ErrorResponse, SuccessResponse


def _get_current_time() -> str:
    """Retorna a data/hora atual no formato YYYday-MM-DD HH:MM."""
    return datetime.now().strftime("%Y-%m-%d %H:%M")


def _extract_endpoint_from_request(request: Request | str) -> str:
    """Extrai o endpoint da requisição ou usa a string fornecida."""
    if isinstance(request, str):
        return request
    path = request.url.path
    query = request.url.query
    return f"{path}?{query}" if query else path


def success_response(
    endpoint: str,
    mcp_tool: str,
    data: list | dict | None = None,
    message: str = "Dados obtidos com sucesso",
    code: int = 200,
) -> SuccessResponse:
    """
    Cria uma resposta padronizada de sucesso.
    
    Args:
        endpoint: URL do endpoint (ex: "/api/recommendations/by-artist?artist=Queen&limit=5")
        mcp_tool: Nome da ferramenta MCP associada (ex: "recommender_create_playlist")
        data: Dados a retornar (lista ou dicionário)
        message: Mensagem de sucesso
        code: Código HTTP (padrão: 200)
    
    Returns:
        SuccessResponse com estrutura padronizada
    """
    total = 0
    if isinstance(data, list):
        total = len(data)
    elif isinstance(data, dict) and "genres" in data:
        total = len(data.get("genres", []))
    elif isinstance(data, dict) and "moods" in data:
        total = len(data.get("moods", []))
    elif data is not None:
        total = 1

    return SuccessResponse(
        time=_get_current_time(),
        sucesso=True,
        endpoint=endpoint,
        mcp_tool=mcp_tool,
        codigo=code,
        mensagem=message,
        total=total,
        dados=data,
    )


def error_response(
    endpoint: str,
    mcp_tool: str,
    code: int,
    message: str,
    recommendation: str | None = None,
) -> ErrorResponse:
    """
    Cria uma resposta padronizada de erro.
    
    Args:
        endpoint: URL do endpoint (ex: "/api/recommendations/by-artist?artist=Queen&limit=5")
        mcp_tool: Nome da ferramenta MCP associada
        code: Código HTTP de erro (ex: 404, 400)
        message: Mensagem de erro descritiva
        recommendation: Dica/recomendação para resolver o erro (opcional)
    
    Returns:
        ErrorResponse com estrutura padronizada
    """
    error_detail = ErrorDetail(mensagem=message, recomendacao=recommendation)
    error_payload = ErrorPayload(details=[error_detail])

    return ErrorResponse(
        time=_get_current_time(),
        sucesso=False,
        endpoint=endpoint,
        mcp_tool=mcp_tool,
        codigo=code,
        erros=error_payload,
    )
