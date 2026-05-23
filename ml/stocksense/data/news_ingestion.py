"""
news_ingestion.py — NewsAPI + Yahoo Finance RSS news fetcher.

Fetches recent news articles for a given ticker, scores sentiment
using FinBERT, and caches results to data/news/{ticker}/{date}.jsonl.

This module is decoupled from the prediction model — it only produces
structured sentiment-scored news data for downstream consumers
(feature_engineer, vector_store, or any forecasting model).
"""

import json
import logging
import os
from datetime import datetime, timezone
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)

DATA_BASE = os.environ.get("DATA_BASE", "./data")

# Lazy-loaded sentiment pipeline (FinBERT)
_sentiment_pipeline = None


def _get_sentiment_pipeline():
    """Lazy-load the sentiment analysis pipeline.

    Uses FinBERT for financial text sentiment. Falls back to
    cardiffnlp/twitter-roberta-base-sentiment if FinBERT unavailable.
    """
    global _sentiment_pipeline
    if _sentiment_pipeline is not None:
        return _sentiment_pipeline

    try:
        from transformers import pipeline

        try:
            _sentiment_pipeline = pipeline(
                "sentiment-analysis",
                model="ProsusAI/finbert",
                truncation=True,
                max_length=512,
            )
            logger.info("Loaded FinBERT sentiment model")
        except Exception:
            _sentiment_pipeline = pipeline(
                "sentiment-analysis",
                model="cardiffnlp/twitter-roberta-base-sentiment",
                truncation=True,
                max_length=512,
            )
            logger.info("Loaded twitter-roberta sentiment model (fallback)")
    except ImportError:
        logger.warning("transformers not available — sentiment scoring disabled")
        _sentiment_pipeline = None

    return _sentiment_pipeline


def _score_sentiment(text: str) -> float:
    """Score a single text string for financial sentiment.

    Returns:
        Float in [-1, 1]. Positive = bullish, negative = bearish.
    """
    pipe = _get_sentiment_pipeline()
    if pipe is None:
        return 0.0

    try:
        result = pipe(text[:512])[0]
        label = result["label"].lower()
        score = result["score"]

        # FinBERT labels: positive, negative, neutral
        # twitter-roberta labels: LABEL_0 (neg), LABEL_1 (neutral), LABEL_2 (pos)
        if label in ("positive", "label_2"):
            return score
        elif label in ("negative", "label_0"):
            return -score
        else:
            return 0.0
    except Exception as e:
        logger.warning(f"Sentiment scoring failed: {e}")
        return 0.0


def _cache_path(ticker: str, date: str) -> str:
    """Return the cache file path for a ticker/date."""
    news_dir = os.path.join(DATA_BASE, "news", ticker.upper())
    os.makedirs(news_dir, exist_ok=True)
    return os.path.join(news_dir, f"{date}.jsonl")


def _load_cache(ticker: str, date: str) -> Optional[List[Dict]]:
    """Load cached news for a ticker/date if available."""
    path = _cache_path(ticker, date)
    if not os.path.exists(path):
        return None

    articles = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                articles.append(json.loads(line))
    return articles


def _save_cache(ticker: str, date: str, articles: List[Dict]) -> None:
    """Save articles to the cache file."""
    path = _cache_path(ticker, date)
    with open(path, "w", encoding="utf-8") as f:
        for article in articles:
            f.write(json.dumps(article, default=str) + "\n")
    logger.info(f"Cached {len(articles)} articles to {path}")


async def fetch_newsapi(ticker: str, from_date: str, to_date: str) -> List[Dict]:
    """Fetch news articles from NewsAPI.

    Args:
        ticker: Stock ticker symbol.
        from_date: Start date (YYYY-MM-DD).
        to_date: End date (YYYY-MM-DD).

    Returns:
        List of article dicts with title, summary, source, url, published_at.
    """
    api_key = os.environ.get("NEWSAPI_KEY", "")
    if not api_key or api_key == "your_newsapi_key_here":
        logger.warning("NEWSAPI_KEY not configured — skipping NewsAPI fetch")
        return []

    try:
        from newsapi import NewsApiClient

        newsapi = NewsApiClient(api_key=api_key)
        response = newsapi.get_everything(
            q=ticker,
            from_param=from_date,
            to=to_date,
            language="en",
            sort_by="relevancy",
            page_size=20,
        )

        articles = []
        for a in response.get("articles", []):
            articles.append({
                "title": a.get("title", ""),
                "summary": a.get("description", ""),
                "source": a.get("source", {}).get("name", "unknown"),
                "url": a.get("url", ""),
                "published_at": a.get("publishedAt", ""),
            })

        logger.info(f"NewsAPI returned {len(articles)} articles for {ticker}")
        return articles

    except ImportError:
        logger.warning("newsapi-python not installed — pip install newsapi-python")
        return []
    except Exception as e:
        logger.error(f"NewsAPI fetch failed: {e}")
        return []


async def fetch_yahoo_rss(ticker: str) -> List[Dict]:
    """Fetch news from Yahoo Finance RSS feed.

    Args:
        ticker: Stock ticker symbol.

    Returns:
        List of article dicts.
    """
    import xml.etree.ElementTree as ET

    try:
        import httpx

        url = f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={ticker}&region=US&lang=en-US"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()

        root = ET.fromstring(resp.text)
        articles = []
        for item in root.findall(".//item"):
            title = item.findtext("title", "")
            link = item.findtext("link", "")
            pub_date = item.findtext("pubDate", "")
            description = item.findtext("description", "")

            articles.append({
                "title": title,
                "summary": description,
                "source": "Yahoo Finance",
                "url": link,
                "published_at": pub_date,
            })

        logger.info(f"Yahoo RSS returned {len(articles)} articles for {ticker}")
        return articles

    except Exception as e:
        logger.warning(f"Yahoo RSS fetch failed for {ticker}: {e}")
        return []


async def fetch_news_for_ticker(ticker: str, date: str) -> List[Dict]:
    """Fetch last 24h news from NewsAPI + Yahoo RSS for a ticker.

    Checks cache first. If not cached, fetches from both sources,
    scores sentiment, deduplicates, caches, and returns.

    Args:
        ticker: Stock ticker symbol (e.g., 'AAPL').
        date: Date string (YYYY-MM-DD) for the news day.

    Returns:
        List of dicts with keys:
            title, summary, sentiment_score, published_at, source, url
    """
    # Check cache first
    cached = _load_cache(ticker, date)
    if cached is not None:
        logger.info(f"Using cached news for {ticker}/{date} ({len(cached)} articles)")
        return cached

    # Fetch from both sources
    newsapi_articles = await fetch_newsapi(ticker, date, date)
    yahoo_articles = await fetch_yahoo_rss(ticker)

    # Merge and deduplicate by title
    all_articles = newsapi_articles + yahoo_articles
    seen_titles = set()
    unique = []
    for a in all_articles:
        title_key = a.get("title", "").strip().lower()
        if title_key and title_key not in seen_titles:
            seen_titles.add(title_key)
            unique.append(a)

    # Score sentiment for each article
    for article in unique:
        text = f"{article.get('title', '')} {article.get('summary', '')}"
        article["sentiment_score"] = _score_sentiment(text.strip())

    # Cache results
    _save_cache(ticker, date, unique)

    logger.info(
        f"Fetched {len(unique)} unique news articles for {ticker} on {date}"
    )
    return unique


def aggregate_news_sentiment(articles: List[Dict]) -> float:
    """Compute mean sentiment score across articles.

    Args:
        articles: List of article dicts with 'sentiment_score' key.

    Returns:
        Mean sentiment in [-1, 1]. Returns 0.0 if no articles.
    """
    scores = [a.get("sentiment_score", 0.0) for a in articles if a.get("sentiment_score") is not None]
    if not scores:
        return 0.0
    return sum(scores) / len(scores)
