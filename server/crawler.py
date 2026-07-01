import asyncio
import aiohttp
from html.parser import HTMLParser
from urllib.parse import urlparse, urljoin
from urllib.robotparser import RobotFileParser
from dataclasses import dataclass, field
from typing import Optional
import time
import uuid

from server.config import (
    CRAWL_DELAY, CRAWL_TIMEOUT, CRAWL_MAX_CONCURRENT,
    CRAWL_USER_AGENT, CRAWL_DEFAULT_MAX_LINKS, CRAWL_DEFAULT_DEPTH,
)


class LinkExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links: list[str] = []
        self.title = ''

    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            for attr, value in attrs:
                if attr == 'href':
                    self.links.append(value)
        if tag == 'title':
            self._in_title = True

    def handle_data(self, data):
        if getattr(self, '_in_title', False):
            self.title = data.strip()
            self._in_title = False

    def handle_endtag(self, tag):
        if tag == 'title':
            self._in_title = False


@dataclass
class CrawlNode:
    id: str
    url: str
    label: str = ''
    title: str = ''
    status_code: int = 0
    cursed: bool = False
    depth: int = 0
    expanded: bool = False
    domain: str = ''


@dataclass
class CrawlSession:
    id: str
    root_url: str
    depth: int
    max_links: int
    status: str = 'pending'
    nodes: dict[str, CrawlNode] = field(default_factory=dict)
    links: list[tuple[str, str]] = field(default_factory=list)
    progress: int = 0
    total: int = 0
    error: str = ''
    created_at: float = 0.0


class RobotsCache:
    def __init__(self):
        self._cache: dict[str, RobotFileParser] = {}
        self._sem = asyncio.Semaphore(1)

    async def can_fetch(self, session: aiohttp.ClientSession, url: str, user_agent: str) -> bool:
        parsed = urlparse(url)
        domain = f'{parsed.scheme}://{parsed.netloc}'
        if domain not in self._cache:
            parser = RobotFileParser()
            robots_url = f'{domain}/robots.txt'
            try:
                async with session.get(robots_url, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                    if resp.status == 200:
                        body = await resp.text()
                        parser.parse(body.splitlines())
                    else:
                        parser.allow_all = True
            except Exception:
                parser.allow_all = True
            self._cache[domain] = parser
        return self._cache[domain].can_fetch(user_agent, url)


def make_node_id(url: str) -> str:
    import hashlib
    return hashlib.md5(url.encode()).hexdigest()[:12]


def normalize_url(url: str) -> str:
    parsed = urlparse(url)
    path = parsed.path.rstrip('/') or '/'
    return f'{parsed.scheme}://{parsed.netloc}{path}'


def make_label(url: str) -> str:
    parsed = urlparse(url)
    host = parsed.netloc.replace('www.', '')
    path = parsed.path.rstrip('/')
    if not path or path == '/':
        return host[:15]
    return (host + path).replace('//', '/')[:15]


class AsyncCrawler:
    def __init__(self):
        self.sessions: dict[str, CrawlSession] = {}
        self._robots = RobotsCache()

    def create_session(self, url: str, depth: int = CRAWL_DEFAULT_DEPTH,
                       max_links: int = CRAWL_DEFAULT_MAX_LINKS) -> str:
        session_id = uuid.uuid4().hex[:8]
        session = CrawlSession(
            id=session_id,
            root_url=normalize_url(url),
            depth=min(depth, CRAWL_DEFAULT_DEPTH),
            max_links=min(max_links, CRAWL_DEFAULT_MAX_LINKS),
            status='running',
            created_at=time.time(),
        )
        self.sessions[session_id] = session
        return session_id

    async def run_crawl(self, session_id: str):
        session = self.sessions.get(session_id)
        if not session:
            return

        connector = aiohttp.TCPConnector(limit=CRAWL_MAX_CONCURRENT)
        async with aiohttp.ClientSession(
            connector=connector,
            headers={'User-Agent': CRAWL_USER_AGENT},
            timeout=aiohttp.ClientTimeout(total=CRAWL_TIMEOUT),
        ) as http:
            try:
                await self._crawl_url(http, session, session.root_url, 0)
            except Exception as e:
                session.error = str(e)
            finally:
                session.status = 'complete' if not session.error else 'error'

    def expand_node(self, session_id: str, node_url: str) -> bool:
        session = self.sessions.get(session_id)
        if not session:
            return False

        node_url = normalize_url(node_url)
        node = session.nodes.get(make_node_id(node_url))
        if not node or node.expanded:
            return False

        node.expanded = True
        expand_depth = node.depth + 1
        if expand_depth > session.depth:
            session.depth = expand_depth
        asyncio.create_task(self._run_expand(session, node_url, expand_depth))
        return True

    async def _run_expand(self, session: CrawlSession, url: str, depth: int):
        connector = aiohttp.TCPConnector(limit=CRAWL_MAX_CONCURRENT)
        async with aiohttp.ClientSession(
            connector=connector,
            headers={'User-Agent': CRAWL_USER_AGENT},
            timeout=aiohttp.ClientTimeout(total=CRAWL_TIMEOUT),
        ) as http:
            try:
                await self._crawl_url(http, session, url, depth)
            except Exception as e:
                session.error = str(e)

    async def _crawl_url(self, http: aiohttp.ClientSession, session: CrawlSession,
                         url: str, depth: int):
        if depth > session.depth:
            return
        if len(session.nodes) >= session.max_links:
            return

        if not await self._robots.can_fetch(http, url, CRAWL_USER_AGENT):
            return

        node_id = make_node_id(url)
        if node_id in session.nodes:
            return

        page_urls: list[str] = []
        page_title = ''
        status_code = 0
        cursed = False

        try:
            await asyncio.sleep(CRAWL_DELAY)
            async with http.get(url, allow_redirects=True) as resp:
                status_code = resp.status
                if resp.status >= 400:
                    cursed = True
                body = await resp.text()
                if len(body) < 100:
                    cursed = True

                extractor = LinkExtractor()
                extractor.feed(body)
                page_title = extractor.title

                base = url
                for href in extractor.links:
                    abs_url = urljoin(base, href)
                    parsed = urlparse(abs_url)
                    if parsed.scheme in ('http', 'https') and parsed.netloc:
                        normalized = normalize_url(abs_url)
                        if normalized != url:
                            page_urls.append(normalized)
        except Exception:
            cursed = True

        parsed = urlparse(url)
        domain = parsed.netloc

        node = CrawlNode(
            id=node_id,
            url=url,
            label=make_label(url),
            title=page_title,
            status_code=status_code,
            cursed=cursed,
            depth=depth,
            domain=domain,
        )
        session.nodes[node_id] = node
        session.total = len(session.nodes)

        for child_url in page_urls[:session.max_links]:
            child_id = make_node_id(child_url)
            link = (node_id, child_id)
            if link not in session.links:
                session.links.append(link)

        session.progress = len(session.nodes)

        if depth < session.depth and len(session.nodes) < session.max_links:
            tasks = []
            for child_url in page_urls[:session.max_links]:
                child_id = make_node_id(child_url)
                if child_id in session.nodes:
                    continue
                if len(session.nodes) >= session.max_links:
                    break
                tasks.append(self._crawl_child(http, session, child_url, depth + 1))
            if tasks:
                await asyncio.gather(*tasks)

    async def _crawl_child(self, http: aiohttp.ClientSession, session: CrawlSession,
                           url: str, depth: int):
        await self._crawl_url(http, session, url, depth)
