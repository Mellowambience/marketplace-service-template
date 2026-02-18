/**
 * Facebook Marketplace Monitor Scraper
 * Searches listings by keyword, location, price range
 * Extracts listing details, seller info, and photos via mobile proxies
 */

import { proxyFetch, getProxy } from '../proxy';

export interface MarketplaceListing {
  id: string;
  title: string;
  price: number;
  currency: string;
  location: string;
  seller: {
    name: string;
    joined: string | null;
    rating: string | null;
    profile_url: string | null;
  };
  condition: string | null;
  posted_at: string;
  images: string[];
  url: string;
  description: string;
  category: string | null;
  is_available: boolean;
}

export interface MarketplaceCategory {
  id: string;
  name: string;
  url: string;
}

const FB_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
};

/**
 * Extract relay/preloaded data from Facebook SSR pages
 */
function extractFbData(html: string): any {
  // Facebook embeds state in multiple formats
  // Look for preloaded marketplace data
  const relayMatch = html.match(/\{"marketplace_search\S*?"\s*:\s*({.+?})\s*,\s*"extensions"/s);
  if (relayMatch) {
    try { return JSON.parse(relayMatch[1]); } catch {}
  }

  // Try __comet_data pattern
  const cometMatch = html.match(/data-sjs>({.+?})<\/script>/s);
  if (cometMatch) {
    try { return JSON.parse(cometMatch[1]); } catch {}
  }

  // Fallback: search for listing-like JSON blocks
  const listingRegex = /"listing_id":"(\d+)"[^}]*"listing_title":"([^"]+)"[^}]*"listing_price":\{[^}]*"amount":"([\d.]+)"[^}]*"currency":"([^"]+)"/g;
  const listings: any[] = [];
  let match;
  while ((match = listingRegex.exec(html)) !== null) {
    listings.push({
      id: match[1],
      title: match[2],
      price: parseFloat(match[3]),
      currency: match[4],
    });
  }
  if (listings.length > 0) return { extracted_listings: listings };

  return null;
}

/**
 * Parse listing from Facebook relay data or HTML
 */
function parseListingFromHtml(html: string, url: string): MarketplaceListing {
  // Try to extract structured data
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  const priceMatch = html.match(/"amount":"([\d.]+)"/);
  const currMatch = html.match(/"currency":"([A-Z]+)"/);
  const descMatch = html.match(/"redacted_description":\{"text":"([^"]+)"/);
  const locationMatch = html.match(/"marketplace_listing_location":\{"reverse_geocode":\{"city":"([^"]+)"/);
  const conditionMatch = html.match(/"condition_text":"([^"]+)"/);
  const sellerMatch = html.match(/"marketplace_listing_seller":\{"name":"([^"]+)"/);
  const idMatch = url.match(/item\/(\d+)/) || url.match(/(\d{10,})/);

  // Extract images
  const imageRegex = /"image":\{"uri":"([^"]+marketplace[^"]+)"/g;
  const images: string[] = [];
  let imgMatch;
  while ((imgMatch = imageRegex.exec(html)) !== null && images.length < 10) {
    images.push(imgMatch[1].replace(/\\\/\\\/g/, '/'));
  }

  const postTimeMatch = html.match(/"creation_time":(\d+)/);

  return {
    id: idMatch ? idMatch[1] : '',
    title: titleMatch ? titleMatch[1].replace(/\s*[|-]\s*Facebook.*$/, '').trim() : '',
    price: priceMatch ? parseFloat(priceMatch[1]) : 0,
    currency: currMatch ? currMatch[1] : 'USD',
    location: locationMatch ? locationMatch[1] : '',
    seller: {
      name: sellerMatch ? sellerMatch[1] : '',
      joined: null,
      rating: null,
      profile_url: null,
    },
    condition: conditionMatch ? conditionMatch[1] : null,
    posted_at: postTimeMatch ? new Date(parseInt(postTimeMatch[1]) * 1000).toISOString() : '',
    images,
    url,
    description: descMatch ? descMatch[1] : '',
    category: null,
    is_available: !html.includes('This listing is no longer available'),
  };
}

/**
 * Search Facebook Marketplace listings
 */
export async function searchMarketplace(
  query: string,
  location?: string,
  minPrice?: number,
  maxPrice?: number,
  radius?: string,
  limit = 20,
): Promise<{ results: MarketplaceListing[]; total_results: number }> {
  // Build marketplace search URL
  const params = new URLSearchParams({
    query,
    ...(minPrice !== undefined && { minPrice: String(Math.round(minPrice * 100)) }),
    ...(maxPrice !== undefined && { maxPrice: String(Math.round(maxPrice * 100)) }),
    ...(radius && { radius: radius.replace('mi', '') }),
  });

  const searchUrl = `https://www.facebook.com/marketplace/search/?${params.toString()}`;

  const response = await proxyFetch(searchUrl, {
    headers: FB_HEADERS,
    maxRetries: 3,
    timeoutMs: 30000,
    followRedirects: true,
  });

  if (!response.ok) {
    throw new Error(`FB Marketplace search failed: ${response.status}`);
  }

  const html = await response.text();
  const fbData = extractFbData(html);

  const results: MarketplaceListing[] = [];

  if (fbData?.extracted_listings) {
    for (const item of fbData.extracted_listings.slice(0, limit)) {
      results.push({
        id: item.id,
        title: item.title,
        price: item.price,
        currency: item.currency,
        location: location || '',
        seller: { name: '', joined: null, rating: null, profile_url: null },
        condition: null,
        posted_at: '',
        images: [],
        url: `https://www.facebook.com/marketplace/item/${item.id}`,
        description: '',
        category: null,
        is_available: true,
      });
    }
  } else {
    // Regex fallback for listing cards
    const cardRegex = /marketplace\/item\/(\d+)/g;
    const seenIds = new Set<string>();
    let cardMatch;
    while ((cardMatch = cardRegex.exec(html)) !== null && results.length < limit) {
      const listingId = cardMatch[1];
      if (seenIds.has(listingId)) continue;
      seenIds.add(listingId);
      results.push({
        id: listingId,
        title: '',
        price: 0,
        currency: 'USD',
        location: location || '',
        seller: { name: '', joined: null, rating: null, profile_url: null },
        condition: null,
        posted_at: '',
        images: [],
        url: `https://www.facebook.com/marketplace/item/${listingId}`,
        description: '',
        category: null,
        is_available: true,
      });
    }
  }

  return { results: results.slice(0, limit), total_results: results.length };
}

/**
 * Get a single listing's full details
 */
export async function getListingDetails(listingId: string): Promise<MarketplaceListing> {
  const url = `https://www.facebook.com/marketplace/item/${listingId}`;

  const response = await proxyFetch(url, {
    headers: FB_HEADERS,
    maxRetries: 3,
    timeoutMs: 30000,
    followRedirects: true,
  });

  if (!response.ok) {
    throw new Error(`FB Marketplace listing fetch failed for ${listingId}: ${response.status}`);
  }

  const html = await response.text();
  return parseListingFromHtml(html, url);
}

/**
 * Get marketplace categories for a location
 */
export async function getCategories(location?: string): Promise<MarketplaceCategory[]> {
  const url = 'https://www.facebook.com/marketplace/categories/';

  const response = await proxyFetch(url, {
    headers: FB_HEADERS,
    maxRetries: 3,
    timeoutMs: 30000,
    followRedirects: true,
  });

  if (!response.ok) {
    throw new Error(`FB Marketplace categories failed: ${response.status}`);
  }

  const html = await response.text();
  const categories: MarketplaceCategory[] = [];

  const catRegex = /marketplace\/category\/([^"?]+)"[^>]*>\s*(?:<[^>]+>)*([^<]+)/g;
  const seen = new Set<string>();
  let match;
  while ((match = catRegex.exec(html)) !== null) {
    const slug = match[1].replace(/\/$/, '');
    if (seen.has(slug)) continue;
    seen.add(slug);
    categories.push({
      id: slug,
      name: match[2].trim(),
      url: `https://www.facebook.com/marketplace/category/${slug}`,
    });
  }

  return categories;
}

/**
 * Monitor new listings posted within a timeframe
 */
export async function getNewListings(
  query: string,
  sinceHours = 1,
  limit = 20,
): Promise<{ results: MarketplaceListing[]; since: string }> {
  // Facebook sorts by recency with daysSinceListed param
  const days = Math.max(1, Math.ceil(sinceHours / 24));
  const params = new URLSearchParams({
    query,
    daysSinceListed: String(days),
    sortBy: 'creation_time_descend',
  });

  const searchUrl = `https://www.facebook.com/marketplace/search/?${params.toString()}`;

  const response = await proxyFetch(searchUrl, {
    headers: FB_HEADERS,
    maxRetries: 3,
    timeoutMs: 30000,
    followRedirects: true,
  });

  if (!response.ok) {
    throw new Error(`FB Marketplace new listings failed: ${response.status}`);
  }

  const html = await response.text();
  const fbData = extractFbData(html);
  const sinceTime = new Date(Date.now() - sinceHours * 3600_000).toISOString();

  const results: MarketplaceListing[] = [];

  if (fbData?.extracted_listings) {
    for (const item of fbData.extracted_listings.slice(0, limit)) {
      results.push({
        id: item.id,
        title: item.title,
        price: item.price,
        currency: item.currency,
        location: '',
        seller: { name: '', joined: null, rating: null, profile_url: null },
        condition: null,
        posted_at: '',
        images: [],
        url: `https://www.facebook.com/marketplace/item/${item.id}`,
        description: '',
        category: null,
        is_available: true,
      });
    }
  } else {
    const cardRegex = /marketplace\/item\/(\d+)/g;
    const seenIds = new Set<string>();
    let cardMatch;
    while ((cardMatch = cardRegex.exec(html)) !== null && results.length < limit) {
      const listingId = cardMatch[1];
      if (seenIds.has(listingId)) continue;
      seenIds.add(listingId);
      results.push({
        id: listingId, title: '', price: 0, currency: 'USD', location: '',
        seller: { name: '', joined: null, rating: null, profile_url: null },
        condition: null, posted_at: '', images: [],
        url: `https://www.facebook.com/marketplace/item/${listingId}`,
        description: '', category: null, is_available: true,
      });
    }
  }

  return { results: results.slice(0, limit), since: sinceTime };
}
