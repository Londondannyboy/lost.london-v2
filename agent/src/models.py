"""Pydantic models for Lost London V2 agent."""

from pydantic import BaseModel, Field
from typing import Optional, Literal, Any
from enum import Enum


class Article(BaseModel):
    """Article from the Lost London knowledge base."""
    id: str
    title: str
    content: str
    slug: Optional[str] = None
    excerpt: Optional[str] = None
    hero_image_url: Optional[str] = None
    score: float = 0.0


class SearchResults(BaseModel):
    """Results from article search."""
    articles: list[Article]
    query: str


class ArticleCardData(BaseModel):
    """Data for rendering an article card in the UI."""
    id: str
    title: str
    excerpt: str
    hero_image_url: Optional[str] = None
    slug: str
    score: float = 0.0


class MapLocation(BaseModel):
    """Location data for map rendering."""
    name: str
    lat: float
    lng: float
    description: Optional[str] = None


class TimelineEvent(BaseModel):
    """Event for timeline visualization."""
    year: int
    title: str
    description: str
    article_id: Optional[str] = None


class VICResponse(BaseModel):
    """Structured response from VIC agent."""
    response_text: str = Field(description="VIC's spoken response to the user")
    source_titles: list[str] = Field(default_factory=list, description="Titles of articles used")


class AppState(BaseModel):
    """Shared state between frontend and agent."""
    current_topic: Optional[str] = None
    last_articles: list[ArticleCardData] = Field(default_factory=list)
    user_name: Optional[str] = None
    conversation_history: list[str] = Field(default_factory=list)


# =============================================================================
# MULTI-AGENT MODELS
# =============================================================================

class SpeakerSegment(BaseModel):
    """
    A segment of a multi-agent response.

    Used when VIC delegates to Librarian - each response segment
    is tagged with who is speaking.
    """
    speaker: Literal["vic", "librarian"] = Field(
        description="Which agent is speaking: 'vic' for storytelling, 'librarian' for research"
    )
    content: str = Field(description="The text content of this segment")
    ui_components: list[str] = Field(
        default_factory=list,
        description="UI components to render (e.g., 'ArticleGrid', 'LocationMap')"
    )
    ui_data: Optional[Any] = Field(
        default=None,
        description="Data for the UI components (articles, location, etc.)"
    )


class MultiAgentResponse(BaseModel):
    """
    Response from multi-agent interaction.

    Contains segments from VIC and/or Librarian, plus metadata.
    """
    segments: list[SpeakerSegment] = Field(
        default_factory=list,
        description="Ordered list of response segments from different speakers"
    )
    mode: Literal["dual_voice", "vic_narrates"] = Field(
        default="vic_narrates",
        description="Voice mode: 'vic_narrates' = single voice, 'dual_voice' = separate voices"
    )
    primary_speaker: Literal["vic", "librarian"] = Field(
        default="vic",
        description="The primary speaker for this response"
    )


class LibrarianDelegation(BaseModel):
    """
    Result from delegating to the Librarian agent.

    Used by VIC when calling delegate_to_librarian tool.
    """
    speaker: Literal["librarian"] = "librarian"
    content: str = Field(description="Librarian's brief response")
    ui_component: Optional[str] = Field(
        default=None,
        description="UI component to render (ArticleGrid, LocationMap, Timeline, BookDisplay)"
    )
    ui_data: Optional[Any] = Field(
        default=None,
        description="Data for the UI component"
    )
    found: bool = Field(default=True, description="Whether the research found results")
