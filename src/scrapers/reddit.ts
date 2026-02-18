/**
 * Reddit Scraper — Mobile Proxy Intelligence
 * Searches posts/comments, tracks trends, extracts engagement
 * via Proxies.sx mobile proxies (bypasses Reddit datacenter blocks)
 */

import { proxyFetch, getProxy } from '../proxy';

export interface RedditPost {
  id: string;
  title: string;
  subreddit: string;
  author: string;
  score: number;
  num_comments: number;
  url: string;
  permalink: string;
  created_utc: number;
  body_preview: string;
  is_self: boolean;
  thumbnail: string | null;
  link_flair_text: string | null;
  upvote_ratio: number;
  awards: number;
}

export interface RedditComment {
  id: string;
  author: string;
  body: string;
  score: number;
  created_utc: number;
  depth: number;
  is_op: boolean;
  awards: number;
  replies_count: number;
}

export interface RedditThread {
  post: RedditPost;
  comments: RedditComment[];
  total_comments: number;
}

export interface TrendingTopic {
  title: string;
  subreddit: string;
  rank: number;
  score: number;
  num_comments: number;
  url: string;
  created_utc: number;
}

const REDDIT_BASE = 'https://www.reddit.com';
const OLD_REDDIT = 'https://old.reddit.com';

const REDDIT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

function truncate(text: string, max: number): string {
  if (!text || text.length <= max) return text || '';
  return text.slice(0, max) + '...';
}

function parsePost(data: any): RedditPost {
  const d = data?.data || data;
  return {
    id: d.id || d.name || '',
    title: d.title || '',
    subreddit: d.subreddit_name_prefixed || `r/${d.subreddit || ''}`,
    author: d.author || '[deleted]',
    score: d.score ?? 0,
    num_comments: d.num_comments ?? 0,
    url: d.url || '',
    permalink: d.permalink ? `https://reddit.com${d.permalink}` : '',
    created_utc: d.created_utc ?? 0,
    body_preview: truncate(d.selftext || '', 500),
    is_self: d.is_self ?? false,
    thumbnail: d.thumbnail && d.thumbnail !== 'self' && d.thumbnail !== 'default' ? d.thumbnail : null,
    link_flair_text: d.link_flair_text || null,
    upvote_ratio: d.upvote_ratio ?? 0,
    awards: d.total_awards_received ?? 0,
  };
}

function parseComment(data: any, opAuthor: string): RedditComment {
  const d = data?.data || data;
  return {
    id: d.id || d.name || '',
    author: d.author || '[deleted]',
    body: truncate(d.body || '', 1000),
    score: d.score ?? 0,
    created_utc: d.created_utc ?? 0,
    depth: d.depth ?? 0,
    is_op: d.author === opAuthor,
    awards: d.total_awards_received ?? 0,
    replies_count: typeof d.replies === 'object' ? (d.replies?.data?.children?.length ?? 0) : 0,
  };
}

function flattenComments(children: any[], opAuthor: string, maxDepth = 3): RedditComment[] {
  const results: RedditComment[] = [];
  for (const child of children) {
    if (child.kind === 'more') continue;
    const comment = parseComment(child, opAuthor);
    if (comment.depth <= maxDepth) {
      results.push(comment);
    }
    const replies = child.data?.replies?.data?.children;
    if (replies && Array.isArray(replies)) {
      results.push(...flattenComments(replies, opAuthor, maxDepth));
    }
  }
  return results;
}

/**
 * Search Reddit posts by keyword
 */
export async function searchReddit(
  query: string,
  subreddit = 'all',
  sort: 'relevance' | 'hot' | 'new' | 'top' | 'comments' = 'relevance',
  time: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all' = 'week',
  limit = 25,
): Promise<{ results: RedditPost[]; total_results: number }> {
  const sub = subreddit === 'all' ? '' : `/r/${encodeURIComponent(subreddit)}`;
  const url = `${REDDIT_BASE}${sub}/search.json?q=${encodeURIComponent(query)}&sort=${sort}&t=${time}&limit=${Math.min(limit, 100)}&restrict_sr=${subreddit !== 'all' ? 'on' : 'off'}`;

  const response = await proxyFetch(url, {
    headers: REDDIT_HEADERS,
    maxRetries: 3,
    timeoutMs: 30000,
  });

  if (!response.ok) {
    throw new Error(`Reddit search failed: ${response.status} ${response.statusText}`);
  }

  const json: any = await response.json();
  const posts = (json?.data?.children || []).map(parsePost);

  return {
    results: posts,
    total_results: posts.length,
  };
}

/**
 * Get trending posts (top/hot posts from popular or country-specific subreddits)
 */
export async function getTrending(
  country = 'US',
  limit = 25,
): Promise<TrendingTopic[]> {
  // Use r/popular which shows trending across Reddit
  const url = `${REDDIT_BASE}/r/popular/hot.json?limit=${Math.min(limit, 100)}&geo_filter=${country}`;

  const response = await proxyFetch(url, {
    headers: REDDIT_HEADERS,
    maxRetries: 3,
    timeoutMs: 30000,
  });

  if (!response.ok) {
    throw new Error(`Reddit trending failed: ${response.status}`);
  }

  const json: any = await response.json();
  const children = json?.data?.children || [];

  return children.map((child: any, i: number) => {
    const d = child.data || {};
    return {
      title: d.title || '',
      subreddit: d.subreddit_name_prefixed || `r/${d.subreddit || ''}`,
      rank: i + 1,
      score: d.score ?? 0,
      num_comments: d.num_comments ?? 0,
      url: d.permalink ? `https://reddit.com${d.permalink}` : '',
      created_utc: d.created_utc ?? 0,
    };
  });
}

/**
 * Get top posts from a specific subreddit
 */
export async function getSubredditTop(
  subreddit: string,
  time: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all' = 'day',
  limit = 25,
): Promise<RedditPost[]> {
  const url = `${REDDIT_BASE}/r/${encodeURIComponent(subreddit)}/top.json?t=${time}&limit=${Math.min(limit, 100)}`;

  const response = await proxyFetch(url, {
    headers: REDDIT_HEADERS,
    maxRetries: 3,
    timeoutMs: 30000,
  });

  if (!response.ok) {
    throw new Error(`Subreddit top failed for r/${subreddit}: ${response.status}`);
  }

  const json: any = await response.json();
  return (json?.data?.children || []).map(parsePost);
}

/**
 * Get full thread with comments
 */
export async function getThread(
  threadId: string,
  sort: 'best' | 'top' | 'new' | 'controversial' | 'old' = 'best',
): Promise<RedditThread> {
  // Strip t3_ prefix if present
  const cleanId = threadId.replace(/^t3_/, '');
  const url = `${REDDIT_BASE}/comments/${cleanId}.json?sort=${sort}&limit=200&depth=4`;

  const response = await proxyFetch(url, {
    headers: REDDIT_HEADERS,
    maxRetries: 3,
    timeoutMs: 30000,
  });

  if (!response.ok) {
    throw new Error(`Thread fetch failed for ${cleanId}: ${response.status}`);
  }

  const json: any = await response.json();

  if (!Array.isArray(json) || json.length < 2) {
    throw new Error(`Invalid thread response for ${cleanId}`);
  }

  const postData = json[0]?.data?.children?.[0];
  const post = parsePost(postData);
  const opAuthor = post.author;

  const commentChildren = json[1]?.data?.children || [];
  const comments = flattenComments(commentChildren, opAuthor);

  return {
    post,
    comments,
    total_comments: post.num_comments,
  };
}
