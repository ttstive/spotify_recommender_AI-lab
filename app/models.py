from pydantic import BaseModel


class SongSearchResult(BaseModel):
    artist: str
    song: str


class RecommendedTrackOut(BaseModel):
    name: str
    artist: str
    spotify_url: str
    distance: float


class GenreListResponse(BaseModel):
    genres: list[str]


class MoodListResponse(BaseModel):
    moods: list[str]


# Response standardization models
class ErrorDetail(BaseModel):
    """Detalhe de erro com mensagem e recomendação."""
    mensagem: str
    recomendacao: str | None = None


class ErrorPayload(BaseModel):
    """Payload de erro com lista de detalhes."""
    details: list[ErrorDetail]


class SuccessResponse(BaseModel):
    """Resposta padronizada de sucesso."""
    time: str
    sucesso: bool = True
    endpoint: str
    mcp_tool: str
    codigo: int
    mensagem: str
    total: int
    dados: list | dict | None = None


class ErrorResponse(BaseModel):
    """Resposta padronizada de erro."""
    time: str
    sucesso: bool = False
    endpoint: str
    mcp_tool: str
    codigo: int
    erros: ErrorPayload
