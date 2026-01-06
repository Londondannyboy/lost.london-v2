"""Pydantic models for Lost London V2 agent."""

from pydantic import BaseModel, Field
from typing import Optional
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
