import asyncio
import uvicorn
from fastapi import FastAPI
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from server.crawler import AsyncCrawler
from server.config import SERVER_HOST, SERVER_PORT

app = FastAPI(title='KRUX LinkMapper', docs_url=None, redoc_url=None)
crawler = AsyncCrawler()


class CrawlRequest(BaseModel):
    url: str
    depth: int = 1
    max_links: int = 100


class ExpandRequest(BaseModel):
    session_id: str
    node_url: str


@app.post('/api/crawl')
async def start_crawl(req: CrawlRequest):
    session_id = crawler.create_session(req.url, req.depth, req.max_links)
    asyncio.create_task(crawler.run_crawl(session_id))
    return {'session_id': session_id}


@app.get('/api/status/{session_id}')
async def get_status(session_id: str):
    session = crawler.sessions.get(session_id)
    if not session:
        return {'error': 'session not found'}, 404
    return {
        'status': session.status,
        'progress': session.progress,
        'total': session.total,
        'node_count': len(session.nodes),
        'link_count': len(session.links),
        'error': session.error,
        'depth': session.depth,
    }


@app.get('/api/graph/{session_id}')
async def get_graph(session_id: str):
    session = crawler.sessions.get(session_id)
    if not session:
        return {'error': 'session not found'}, 404
    return {
        'nodes': [
            {
                'id': n.id,
                'url': n.url,
                'label': n.label,
                'title': n.title,
                'cursed': n.cursed,
                'depth': n.depth,
                'domain': n.domain,
                'expanded': n.expanded,
            }
            for n in session.nodes.values()
        ],
        'links': [
            {'source': s, 'target': t}
            for s, t in session.links
        ],
    }


@app.post('/api/expand')
async def expand_node(req: ExpandRequest):
    ok = crawler.expand_node(req.session_id, req.node_url)
    return {'expanded': ok}


@app.get('/api/proxy')
async def proxy_url(url: str):
    import aiohttp
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                body = await resp.read()
                content_type = resp.headers.get('Content-Type', 'text/html')
                return Response(content=body, media_type=content_type)
    except Exception:
        return Response(content='', media_type='text/html')


@app.get('/api/sessions')
async def list_sessions():
    return {
        sid: {
            'status': s.status,
            'root_url': s.root_url,
            'node_count': len(s.nodes),
            'created_at': s.created_at,
        }
        for sid, s in crawler.sessions.items()
    }


app.mount('/', StaticFiles(directory='client', html=True), name='client')


def run():
    uvicorn.run('server.main:app', host=SERVER_HOST, port=SERVER_PORT, reload=True)


if __name__ == '__main__':
    run()
