import { NextRequest, NextResponse } from 'next/server';

const REQUEST_TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 8;

const isHttpUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const decodeEscapedUrl = (value: string) =>
  value
    .replace(/\\u0026/g, '&')
    .replace(/\\u003d/g, '=')
    .replace(/\\u003f/g, '?')
    .replace(/\\u002f/g, '/')
    .replace(/\\\//g, '/')
    .replace(/&amp;/gi, '&');

const isGoogleMapsHost = (value: string) => {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    return (
      host.includes('google.') ||
      host.includes('maps.google.') ||
      host.includes('maps.app.goo.gl') ||
      host === 'goo.gl' ||
      host.endsWith('.goo.gl')
    );
  } catch {
    return false;
  }
};

const extractGoogleMapUrlFromHtml = (html: string): string | null => {
  const decoded = decodeEscapedUrl(html);
  const patterns = [
    /https?:\/\/(?:www\.)?google\.[^"'\\\s<>()]+/gi,
    /https?:\/\/(?:maps\.)?google\.[^"'\\\s<>()]+/gi,
  ];

  for (const pattern of patterns) {
    const matches = decoded.match(pattern);
    if (!matches) continue;
    for (const candidate of matches) {
      const cleaned = decodeEscapedUrl(candidate).replace(/[\])}>.,;]+$/, '');
      if (!isHttpUrl(cleaned)) continue;
      if (isGoogleMapsHost(cleaned)) return cleaned;
    }
  }

  return null;
};

const resolveByManualRedirect = async (
  startUrl: string,
  signal: AbortSignal,
): Promise<string> => {
  let currentUrl = startUrl;

  for (let attempt = 0; attempt < MAX_REDIRECTS; attempt += 1) {
    const response = await fetch(currentUrl, {
      method: 'GET',
      redirect: 'manual',
      cache: 'no-store',
      signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      },
    });

    const isRedirect = [301, 302, 303, 307, 308].includes(response.status);
    if (!isRedirect) {
      return isHttpUrl(response.url) ? response.url : currentUrl;
    }

    const locationHeader = response.headers.get('location');
    if (!locationHeader) {
      return isHttpUrl(response.url) ? response.url : currentUrl;
    }

    const nextUrl = new URL(locationHeader, currentUrl).toString();
    if (!isHttpUrl(nextUrl) || nextUrl === currentUrl) {
      return currentUrl;
    }

    currentUrl = nextUrl;
  }

  return currentUrl;
};

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get('url')?.trim() ?? '';
  if (!rawUrl || !isHttpUrl(rawUrl)) {
    return NextResponse.json(
      { message: 'Invalid url query parameter.' },
      { status: 400 },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    let resolvedUrl = rawUrl;

    // First try explicit redirect chain resolution.
    try {
      resolvedUrl = await resolveByManualRedirect(rawUrl, controller.signal);
    } catch {
      resolvedUrl = rawUrl;
    }

    if (isGoogleMapsHost(resolvedUrl) && !resolvedUrl.includes('maps.app.goo.gl')) {
      return NextResponse.json({ resolvedUrl });
    }

    // Fallback: follow redirects and parse returned HTML for an embedded/escaped Google Maps URL.
    const response = await fetch(rawUrl, {
      method: 'GET',
      redirect: 'follow',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      },
    });

    resolvedUrl = isHttpUrl(response.url) ? response.url : resolvedUrl;
    if (!resolvedUrl || !isHttpUrl(resolvedUrl)) {
      resolvedUrl = rawUrl;
    }

    if (resolvedUrl.includes('maps.app.goo.gl') || resolvedUrl.includes('goo.gl/')) {
      const bodyText = await response.text().catch(() => '');
      const extracted = extractGoogleMapUrlFromHtml(bodyText);
      if (extracted && isHttpUrl(extracted)) {
        resolvedUrl = extracted;
      }
    }

    return NextResponse.json({ resolvedUrl });
  } catch {
    // Fallback to original URL so UI still has a usable open-map link.
    return NextResponse.json({ resolvedUrl: rawUrl });
  } finally {
    clearTimeout(timeout);
  }
}
