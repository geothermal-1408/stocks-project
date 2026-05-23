"""
sentiment_ingestion.py — Reddit PRAW social sentiment fetcher.

Fetches recent posts mentioning a ticker from Reddit subreddits
(r/wallstreetbets, r/stocks, r/investing), scores sentiment, and
caches results to data/reddit/{ticker}/{date}.jsonl.

This module is fully decoupled from the prediction model — it only
produces structured sentiment data for downstream feature engineering.
"""

import json
import logging
import os
from datetime import datetime, timezone
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)

DATA_BASE = os.environ.get("DATA_BASE", "./data")

# Target subreddits for stock sentiment
TARGET_SUBREDDITS = ["wallstreetbets", "stocks", "investing"]

# Lazy-loaded sentiment pipeline
_sentiment_pipeline = None


def _get_sentiment_pipeline():
    """Lazy-load sentiment pipeline. Shared with news_ingestion if already loaded."""
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
        except Exception:
            _sentiment_pipeline = pipeline(
                "sentiment-analysis",
                model="cardiffnlp/twitter-roberta-base-sentiment",
                truncation=True,
                max_length=512,
            )
    except ImportError:
        logger.warning("transformers not available — sentiment scoring disabled")
        _sentiment_pipeline = None

    return _sentiment_pipeline


def _score_text(text: str) -> float:
    """Score a single text for sentiment in [-1, 1]."""
    pipe = _get_sentiment_pipeline()
    if pipe is None:
        return 0.0

    try:
        result = pipe(text[:512])[0]
        label = result["label"].lower()
        score = result["score"]

        if label in ("positive", "label_2"):
            return score
        elif label in ("negative", "label_0"):
            return -score
        else:
            return 0.0
    except Exception:
        return 0.0


def _cache_path(ticker: str, date: str) -> str:
    """Return cache file path for reddit data."""
    reddit_dir = os.path.join(DATA_BASE, "reddit", ticker.upper())
    os.makedirs(reddit_dir, exist_ok=True)
    return os.path.join(reddit_dir, f"{date}.jsonl")


def _load_cache(ticker: str, date: str) -> Optional[List[Dict]]:
    """Load cached reddit posts if available."""
    path = _cache_path(ticker, date)
    if not os.path.exists(path):
        return None

    posts = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                posts.append(json.loads(line))
    return posts


def _save_cache(ticker: str, date: str, posts: List[Dict]) -> None:
    """Save posts to cache."""
    path = _cache_path(ticker, date)
    with open(path, "w", encoding="utf-8") as f:
        for post in posts:
            f.write(json.dumps(post, default=str) + "\n")
    logger.info(f"Cached {len(posts)} reddit posts to {path}")


def _get_praw_client():
    """Initialize PRAW Reddit client from environment variables.

    Returns:
        praw.Reddit instance or None if not configured.
    """
    client_id = os.environ.get("REDDIT_CLIENT_ID", "")
    client_secret = os.environ.get("REDDIT_CLIENT_SECRET", "")
    user_agent = os.environ.get("REDDIT_USER_AGENT", "stocksense-v2/1.0")

    if not client_id or client_id == "your_reddit_client_id":
        logger.warning("REDDIT_CLIENT_ID not configured — skipping Reddit fetch")
        return None

    try:
        import praw

        return praw.Reddit(
            client_id=client_id,
            client_secret=client_secret,
            user_agent=user_agent,
        )
    except ImportError:
        logger.warning("praw not installed — pip install praw")
        return None
    except Exception as e:
        logger.error(f"PRAW initialization failed: {e}")
        return None


def _search_subreddit(
    reddit, subreddit_name: str, ticker: str, limit: int = 20
) -> List[Dict]:
    """Search a single subreddit for posts mentioning ticker.

    Args:
        reddit: PRAW Reddit instance.
        subreddit_name: Name of the subreddit.
        ticker: Stock ticker to search for.
        limit: Max posts to fetch per subreddit.

    Returns:
        List of post dicts.
    """
    posts = []
    try:
        subreddit = reddit.subreddit(subreddit_name)
        # Search for ticker mentions (e.g., $AAPL, AAPL)
        search_queries = [f"${ticker}", ticker]

        seen_ids = set()
        for query in search_queries:
            for submission in subreddit.search(
                query, sort="new", time_filter="day", limit=limit
            ):
                if submission.id in seen_ids:
                    continue
                seen_ids.add(submission.id)

                posts.append({
                    "post_id": submission.id,
                    "subreddit": subreddit_name,
                    "post_title": submission.title,
                    "score": submission.score,
                    "upvote_ratio": submission.upvote_ratio,
                    "comment_count": submission.num_comments,
                    "created_utc": datetime.fromtimestamp(
                        submission.created_utc, tz=timezone.utc
                    ).isoformat(),
                    "url": f"https://reddit.com{submission.permalink}",
                })

    except Exception as e:
        logger.warning(f"Error searching r/{subreddit_name} for {ticker}: {e}")

    return posts


async def fetch_reddit_posts(
    ticker: str, limit: int = 50, date: Optional[str] = None
) -> List[Dict]:
    """Fetch recent Reddit posts mentioning a ticker.

    Searches across TARGET_SUBREDDITS, deduplicates, scores sentiment,
    and caches results.

    Args:
        ticker: Stock ticker symbol.
        limit: Max posts per subreddit.
        date: Date string for caching (defaults to today).

    Returns:
        List of post dicts with sentiment_score.
    """
    if date is None:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Check cache
    cached = _load_cache(ticker, date)
    if cached is not None:
        logger.info(f"Using cached reddit posts for {ticker}/{date}")
        return cached

    reddit = _get_praw_client()
    if reddit is None:
        return []

    # Fetch from all target subreddits
    all_posts = []
    for sub_name in TARGET_SUBREDDITS:
        posts = _search_subreddit(
            reddit, sub_name, ticker, limit=limit // len(TARGET_SUBREDDITS)
        )
        all_posts.extend(posts)

    # Score sentiment
    for post in all_posts:
        post["sentiment_score"] = _score_text(post.get("post_title", ""))

    # Cache
    _save_cache(ticker, date, all_posts)

    logger.info(f"Fetched {len(all_posts)} reddit posts for {ticker} on {date}")
    return all_posts


async def fetch_reddit_sentiment(ticker: str, limit: int = 50) -> float:
    """Fetch recent posts mentioning ticker from PRAW.

    Convenience wrapper that returns aggregate sentiment score.

    Args:
        ticker: Stock ticker symbol.
        limit: Max posts to fetch.

    Returns:
        Aggregate sentiment score in [-1, 1].
    """
    posts = await fetch_reddit_posts(ticker, limit=limit)
    return aggregate_reddit_sentiment(posts)


def aggregate_reddit_sentiment(posts: List[Dict]) -> float:
    """Compute weighted mean sentiment from Reddit posts.

    Weights by upvote score to prioritize high-engagement posts.

    Args:
        posts: List of post dicts with 'sentiment_score' and 'score'.

    Returns:
        Weighted sentiment in [-1, 1]. Returns 0.0 if no posts.
    """
    if not posts:
        return 0.0

    total_weight = 0.0
    weighted_sum = 0.0

    for post in posts:
        sentiment = post.get("sentiment_score", 0.0)
        # Use Reddit score as weight (min 1 to avoid zero-weight)
        weight = max(1, abs(post.get("score", 1)))
        weighted_sum += sentiment * weight
        total_weight += weight

    if total_weight == 0:
        return 0.0

    return weighted_sum / total_weight
