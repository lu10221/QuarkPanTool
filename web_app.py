"""Local browser UI for QuarkPanTool. Run after building web/: python web_app.py."""

import asyncio
import json
import os
import re
import secrets
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import httpx
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)

from quark import QuarkPanFileManager  # noqa: E402
from quark_login import CONFIG_DIR, QuarkLogin  # noqa: E402


class ApiError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


def saved_cookie() -> str:
    value = QuarkLogin().check_cookies()
    if isinstance(value, dict):
        return QuarkLogin.dict_to_cookie_str(value)
    return value or ''


def manager(cookie: str | None = None) -> QuarkPanFileManager:
    value = saved_cookie() if cookie is None else cookie.strip()
    if not value:
        raise ApiError('请先登录夸克网盘', 401)
    return QuarkPanFileManager(cookies=value)


async def account_info(m: QuarkPanFileManager) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(
            'https://pan.quark.cn/account/info',
            params={'fr': 'pc', 'platform': 'pc'}, headers=m.headers,
        )
        response.raise_for_status()
        payload = response.json()
    data = payload.get('data')
    if not isinstance(data, dict) or not data.get('nickname'):
        raise ApiError('登录状态已过期，请重新登录', 401)
    return {'nickname': data['nickname']}


def checked_payload(payload: dict) -> dict:
    if payload.get('code') not in (None, 0) or payload.get('status') not in (None, 200):
        raise ApiError(payload.get('message') or '夸克接口返回错误', 502)
    return payload.get('data') or {}


def checked_fid(value: str) -> str:
    if not isinstance(value, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,128}', value):
        raise ApiError('无效的文件 ID')
    return value


def checked_name(value: str) -> str:
    if not isinstance(value, str) or not value.strip() or len(value) > 255:
        raise ApiError('文件名须为 1-255 个字符')
    return value.strip()


def parse_share_link(value: str) -> tuple[str, str]:
    parsed = urlparse(value.strip())
    if parsed.scheme != 'https' or parsed.hostname != 'pan.quark.cn':
        raise ApiError('仅支持 https://pan.quark.cn/s/ 分享链接')
    match = re.fullmatch(r'/s/([A-Za-z0-9]+)', parsed.path.rstrip('/'))
    if not match:
        raise ApiError('分享链接格式不正确')
    return match.group(1), parse_qs(parsed.query).get('pwd', [''])[0]


async def list_files(m: QuarkPanFileManager, parent: str) -> list[dict]:
    checked_fid(parent)
    page = 1
    result = []
    while True:
        payload = await m.get_sorted_file_list(
            parent, page=str(page), size='100', fetch_total='1',
            sort='file_type:asc,file_name:asc',
        )
        data = checked_payload(payload)
        items = data.get('list', [])
        result.extend({
            'fid': item['fid'], 'name': item['file_name'],
            'parent': item.get('pdir_fid', parent), 'dir': bool(item['dir']),
            'size': item.get('size') or 0,
            'updatedAt': item.get('updated_at') or item.get('l_updated_at'),
        } for item in items)
        total = payload.get('metadata', {}).get('_total', len(result))
        if len(result) >= total or not items:
            return result
        page += 1


async def create_folder(m: QuarkPanFileManager, parent: str, name: str) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            'https://drive-pc.quark.cn/1/clouddrive/file',
            params={'pr': 'ucpro', 'fr': 'pc', 'uc_param_str': ''},
            json={'pdir_fid': checked_fid(parent), 'file_name': checked_name(name),
                  'dir_path': '', 'dir_init_lock': False},
            headers=m.headers,
        )
        response.raise_for_status()
        return checked_payload(response.json())


async def rename_file(m: QuarkPanFileManager, fid: str, name: str) -> None:
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            'https://drive-pc.quark.cn/1/clouddrive/file/rename',
            params={'pr': 'ucpro', 'fr': 'pc', 'uc_param_str': ''},
            json={'fid': checked_fid(fid), 'file_name': checked_name(name)},
            headers=m.headers,
        )
        response.raise_for_status()
        checked_payload(response.json())


async def delete_file(m: QuarkPanFileManager, fid: str) -> None:
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            'https://drive-pc.quark.cn/1/clouddrive/file/delete',
            params={'pr': 'ucpro', 'fr': 'pc', 'uc_param_str': ''},
            json={'action_type': 2, 'filelist': [checked_fid(fid)], 'exclude_fids': []},
            headers=m.headers,
        )
        response.raise_for_status()
        data = checked_payload(response.json())
        if data.get('task_id'):
            await poll_save(m, data['task_id'])


async def poll_save(m: QuarkPanFileManager, task_id: str) -> None:
    async with httpx.AsyncClient(timeout=30) as client:
        for attempt in range(50):
            await asyncio.sleep(0.8)
            response = await client.get(
                'https://drive-pc.quark.cn/1/clouddrive/task',
                params={'pr': 'ucpro', 'fr': 'pc', 'uc_param_str': '',
                        'task_id': task_id, 'retry_index': str(attempt)},
                headers=m.headers,
            )
            response.raise_for_status()
            data = checked_payload(response.json())
            if data.get('status') == 2:
                return
            if data.get('status') in (3, 4):
                raise ApiError(data.get('message') or '转存任务失败', 502)
    raise ApiError('转存任务超时，请在网盘中检查结果', 504)


class TaskStore:
    def __init__(self):
        self.lock = threading.Lock()
        self.tasks: dict[str, dict] = {}

    def create(self, kind: str, total: int) -> str:
        task_id = secrets.token_urlsafe(12)
        with self.lock:
            self.tasks[task_id] = {'id': task_id, 'kind': kind, 'state': 'running',
                                   'current': 0, 'total': total, 'logs': [], 'results': []}
        return task_id

    def record(self, task_id: str, message: str, result: dict | None = None) -> None:
        with self.lock:
            task = self.tasks[task_id]
            task['logs'].append({'time': time.strftime('%H:%M:%S'), 'message': message})
            if result is not None:
                task['results'].append(result)
                task['current'] += 1

    def finish(self, task_id: str, state: str) -> None:
        with self.lock:
            self.tasks[task_id]['state'] = state

    def get(self, task_id: str) -> dict:
        with self.lock:
            if task_id not in self.tasks:
                raise ApiError('任务不存在', 404)
            return json.loads(json.dumps(self.tasks[task_id], ensure_ascii=False))


TASKS = TaskStore()


def filter_share_items(items: list[dict], rules: set[str]) -> tuple[list[dict], int]:
    kept = []
    for item in items:
        if item.get('dir'):
            kept.append(item)
            continue
        name = item.get('file_name', '')
        lower = name.lower()
        promotional = re.match(
            r'^(?:【[^】]*(?:公众号|加微)[^】]*】|\[[^\]]*(?:公众号|加微)[^\]]*\])', name,
        )
        size = item.get('size') or 0
        small_video = (isinstance(size, (int, float)) and
                       lower.endswith(('.mp4', '.mkv', '.avi', '.mov', '.flv', '.wmv', '.ts'))
                       and 0 < size < 2 * 1024 * 1024)
        if ('ext' in rules and lower.endswith(('.txt', '.url', '.html')) or
                'prefix' in rules and promotional or
                'smallVideo' in rules and small_video):
            continue
        kept.append(item)
    return kept, len(items) - len(kept)


async def save_links(task_id: str, links: list[str], folder_id: str,
                     filters: tuple[str, ...] = (), concurrency: int = 1) -> None:
    m = manager()
    semaphore = asyncio.Semaphore(concurrency)

    async def save_one(link: str) -> None:
        async with semaphore:
            await process_link(link)

    async def process_link(link: str) -> None:
        label = link.strip()
        try:
            pwd_id, password = parse_share_link(label)
            stoken = await m.get_stoken(pwd_id, password)
            if not stoken:
                raise ApiError('提取码错误或分享已失效')
            is_owner, items = await m.get_detail(pwd_id, stoken)
            if not items:
                raise ApiError('分享中没有文件')
            if is_owner:
                TASKS.record(task_id, f'已跳过自己的分享：{label}',
                             {'label': label, 'status': 'skipped'})
                return
            items, filtered = filter_share_items(items, set(filters))
            if not items:
                TASKS.record(task_id, f'已跳过：{label}，根目录文件均被过滤',
                             {'label': label, 'status': 'skipped', 'filtered': filtered})
                return
            task = await m.get_share_save_task_id(
                pwd_id, stoken, [item['fid'] for item in items],
                [item['share_fid_token'] for item in items], folder_id,
            )
            await poll_save(m, task)
            TASKS.record(task_id, f'转存完成：{label}' + (f'，过滤 {filtered} 个根目录文件' if filtered else ''),
                         {'label': label, 'status': 'ok', 'filtered': filtered})
        except Exception as exc:
            TASKS.record(task_id, f'转存失败：{label}，{exc}',
                         {'label': label, 'status': 'error', 'error': str(exc)})

    await asyncio.gather(*(save_one(link) for link in links))


async def share_files(task_id: str, items: list[dict], expired: int,
                      pass_mode: str, password: str) -> None:
    m = manager()
    for item in items:
        label = item['name']
        try:
            share_task = await m.get_share_task_id(
                checked_fid(item['fid']), label,
                url_type=1 if pass_mode == 'none' else 2,
                expired_type=expired,
                password=password if pass_mode == 'custom' else '',
            )
            share_id = None
            for _ in range(12):
                try:
                    share_id = await m.get_share_id(share_task)
                    if share_id:
                        break
                except (KeyError, TypeError):
                    pass
                await asyncio.sleep(0.5)
            if not share_id:
                raise ApiError('生成分享链接超时', 504)
            url, title = await m.submit_share(share_id)
            TASKS.record(task_id, f'分享完成：{title}',
                         {'label': title, 'status': 'ok', 'url': url})
        except Exception as exc:
            TASKS.record(task_id, f'分享失败：{label}，{exc}',
                         {'label': label, 'status': 'error', 'error': str(exc)})


async def rename_files(task_id: str, items: list[dict]) -> None:
    m = manager()
    for item in items:
        label = item['name']
        try:
            await rename_file(m, item['fid'], label)
            TASKS.record(task_id, f'重命名完成：{label}',
                         {'label': label, 'status': 'ok'})
        except Exception as exc:
            TASKS.record(task_id, f'重命名失败：{label}，{exc}',
                         {'label': label, 'status': 'error', 'error': str(exc)})


def safe_name(name: str) -> str:
    value = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', name).strip(' .')
    if not value or value.upper().split('.')[0] in {
        'CON', 'PRN', 'AUX', 'NUL', *(f'COM{i}' for i in range(1, 10)),
        *(f'LPT{i}' for i in range(1, 10)),
    }:
        raise ApiError(f'文件名不适合本地保存：{name}')
    return value


async def download_links(task_id: str, links: list[str]) -> None:
    m = manager()
    root = ROOT / 'downloads'
    root.mkdir(exist_ok=True)
    for link in links:
        label = link.strip()
        try:
            pwd_id, password = parse_share_link(label)
            stoken = await m.get_stoken(pwd_id, password)
            if not stoken:
                raise ApiError('提取码错误或分享已失效')
            owner, _ = await m.get_detail(pwd_id, stoken)
            if not owner:
                raise ApiError('请先将分享转存到自己的网盘，再用自己的分享链接下载')
            files: list[tuple[str, list[str], str]] = []

            async def walk(parent: str, parts: list[str]) -> None:
                _, entries = await m.get_detail(pwd_id, stoken, parent)
                for entry in entries:
                    if entry['dir']:
                        await walk(entry['fid'], [*parts, safe_name(entry['file_name'])])
                    else:
                        files.append((entry['fid'], parts, safe_name(entry['file_name'])))

            await walk('0', [])
            if not files:
                raise ApiError('分享中没有可下载的文件')
            count = 0
            async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
                for fid, parts, filename in files:
                    headers = dict(m.headers)
                    for agent in (
                        headers['user-agent'],
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                        'quark-cloud-drive/2.5.56 Electron/18.3.5.12',
                    ):
                        headers['user-agent'] = agent
                        response = await client.post(
                            'https://drive-pc.quark.cn/1/clouddrive/file/download',
                            params={'pr': 'ucpro', 'fr': 'pc', 'sys': 'win32', 've': '2.5.56'},
                            json={'fids': [fid]}, headers=headers,
                        )
                        response.raise_for_status()
                        payload = response.json()
                        if payload.get('code') != 23018:
                            break
                    data = checked_payload(payload)
                    if not data or not data[0].get('download_url'):
                        raise ApiError(f'没有获得下载地址：{filename}', 502)
                    target_dir = root.joinpath(*parts)
                    target_dir.mkdir(parents=True, exist_ok=True)
                    target = target_dir / filename
                    if target.exists():
                        stem, suffix = target.stem, target.suffix
                        index = 2
                        while target.exists():
                            target = target_dir / f'{stem} ({index}){suffix}'
                            index += 1
                    temp = target.with_name(target.name + '.part')
                    download_url = data[0]['download_url']
                    if urlparse(download_url).scheme != 'https':
                        raise ApiError('下载地址不是 HTTPS', 502)
                    try:
                        async with client.stream('GET', download_url, headers={
                            'user-agent': headers['user-agent'],
                            'referer': 'https://pan.quark.cn/',
                        }) as stream:
                            stream.raise_for_status()
                            with temp.open('wb') as output:
                                async for chunk in stream.aiter_bytes():
                                    output.write(chunk)
                        temp.replace(target)
                    finally:
                        temp.unlink(missing_ok=True)
                    count += 1
                    TASKS.record(task_id, f'已下载 {target.relative_to(root)}')
            TASKS.record(task_id, f'下载完成：{count} 个文件，保存到 {root}',
                         {'label': label, 'status': 'ok', 'count': count})
        except Exception as exc:
            TASKS.record(task_id, f'下载失败：{label}，{exc}',
                         {'label': label, 'status': 'error', 'error': str(exc)})


def run_task(task_id: str, coroutine) -> None:
    try:
        asyncio.run(coroutine)
        results = TASKS.get(task_id)['results']
        TASKS.finish(task_id, 'error' if results and all(
            result['status'] == 'error' for result in results) else 'done')
    except Exception as exc:
        TASKS.record(task_id, f'任务中断：{exc}')
        TASKS.finish(task_id, 'error')


class BrowserLogin:
    def __init__(self):
        self.lock = threading.Lock()
        self.confirm = threading.Event()
        self.state = 'idle'
        self.error = ''

    def start(self) -> None:
        with self.lock:
            if self.state in ('opening', 'waiting', 'saving'):
                raise ApiError('登录窗口已经打开')
            self.state = 'opening'
            self.error = ''
            self.confirm.clear()
        threading.Thread(target=self._run, daemon=True).start()

    def _run(self) -> None:
        try:
            with sync_playwright() as playwright:
                context = playwright.firefox.launch_persistent_context(
                    str(ROOT / 'web_browser_data'), headless=False,
                )
                try:
                    page = context.pages[0] if context.pages else context.new_page()
                    page.goto('https://pan.quark.cn/')
                    with self.lock:
                        self.state = 'waiting'
                    if not self.confirm.wait(timeout=300):
                        raise ApiError('登录等待超时')
                    with self.lock:
                        self.state = 'saving'
                    QuarkLogin.save_cookies(page)
                finally:
                    context.close()
            asyncio.run(account_info(manager()))
            with self.lock:
                self.state = 'done'
        except Exception as exc:
            with self.lock:
                self.state = 'error'
                self.error = str(exc)

    def status(self) -> dict:
        with self.lock:
            return {'state': self.state, 'error': self.error}


LOGIN = BrowserLogin()
TOKEN = secrets.token_urlsafe(24)


class Handler(BaseHTTPRequestHandler):
    server_version = 'QuarkPanTool/1.0'

    def check_host(self) -> None:
        if self.headers.get('Host') not in {
            f'127.0.0.1:{self.server.server_port}',
            f'localhost:{self.server.server_port}',
        }:
            raise ApiError('仅接受本机请求', 403)

    def send_json(self, value: dict, status: int = 200) -> None:
        body = json.dumps(value, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(body)

    def request_json(self) -> dict:
        self.check_host()
        if self.headers.get('X-Local-Token') != TOKEN:
            raise ApiError('请求令牌无效', 403)
        origin = self.headers.get('Origin')
        if origin and origin not in {
            f'http://127.0.0.1:{self.server.server_port}',
            f'http://localhost:{self.server.server_port}',
            'http://127.0.0.1:5173', 'http://localhost:5173',
        }:
            raise ApiError('请求来源无效', 403)
        if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
            raise ApiError('仅接受 JSON 请求')
        length = int(self.headers.get('Content-Length', '0'))
        if length < 2 or length > 1024 * 1024:
            raise ApiError('请求体大小无效')
        value = json.loads(self.rfile.read(length))
        if not isinstance(value, dict):
            raise ApiError('请求体须为 JSON 对象')
        return value

    def do_GET(self) -> None:
        try:
            self.check_host()
            route = urlparse(self.path)
            if route.path == '/api/bootstrap':
                self.send_json({'token': TOKEN})
            elif route.path == '/api/session':
                try:
                    info = asyncio.run(account_info(manager()))
                    self.send_json({'connected': True, **info})
                except (ApiError, httpx.HTTPError) as exc:
                    self.send_json({'connected': False, 'error': str(exc)})
            elif route.path == '/api/files':
                parent = parse_qs(route.query).get('parent', ['0'])[0]
                self.send_json({'items': asyncio.run(list_files(manager(), parent))})
            elif route.path == '/api/login/status':
                self.send_json(LOGIN.status())
            elif route.path.startswith('/api/tasks/'):
                self.send_json(TASKS.get(route.path.removeprefix('/api/tasks/')))
            elif route.path.startswith('/api/'):
                raise ApiError('接口不存在', 404)
            else:
                self.send_static(route.path)
        except ApiError as exc:
            self.send_json({'error': str(exc)}, exc.status)
        except Exception as exc:
            self.send_json({'error': str(exc)}, 502)

    def do_POST(self) -> None:
        try:
            body = self.request_json()
            route = urlparse(self.path).path
            if route == '/api/session/cookie':
                cookie = body.get('cookie', '').strip()
                if not cookie or len(cookie) > 32768:
                    raise ApiError('Cookie 内容无效')
                info = asyncio.run(account_info(manager(cookie)))
                (ROOT / CONFIG_DIR / 'cookies.txt').write_text(cookie, encoding='utf-8')
                self.send_json({'connected': True, **info})
            elif route == '/api/session/check':
                cookie = body.get('cookie', '').strip()
                if not cookie or len(cookie) > 32768:
                    raise ApiError('Cookie 内容无效')
                info = asyncio.run(account_info(manager(cookie)))
                self.send_json({'connected': True, **info})
            elif route == '/api/session/logout':
                (ROOT / CONFIG_DIR / 'cookies.txt').unlink(missing_ok=True)
                self.send_json({'connected': False})
            elif route == '/api/links/parse':
                links = body.get('items')
                if not isinstance(links, list) or not 1 <= len(links) <= 100:
                    raise ApiError('请选择 1-100 条分享链接')
                parsed = []
                for link in links:
                    if not isinstance(link, str):
                        raise ApiError('链接格式无效')
                    _, password = parse_share_link(link)
                    parsed.append({'url': link.strip(), 'code': password or '免提取码'})
                self.send_json({'items': parsed})
            elif route == '/api/login/start':
                LOGIN.start()
                self.send_json(LOGIN.status())
            elif route == '/api/login/finish':
                if LOGIN.status()['state'] != 'waiting':
                    raise ApiError('登录窗口尚未就绪')
                LOGIN.confirm.set()
                self.send_json(LOGIN.status())
            elif route == '/api/folders':
                data = asyncio.run(create_folder(
                    manager(), body.get('parent', '0'), body.get('name', ''),
                ))
                self.send_json({'fid': data['fid']})
            elif route == '/api/files/delete':
                asyncio.run(delete_file(manager(), body.get('fid')))
                self.send_json({'deleted': True})
            elif route == '/api/tasks':
                kind = body.get('kind')
                items = body.get('items')
                if not isinstance(items, list) or not 1 <= len(items) <= 100:
                    raise ApiError('请选择 1-100 个项目')
                if kind in ('save', 'download'):
                    if not all(isinstance(item, str) for item in items):
                        raise ApiError('链接格式无效')
                    for item in items:
                        parse_share_link(item)
                    coroutine = (
                        save_links if kind == 'save' else download_links
                    )
                    if kind == 'save':
                        filters = body.get('filters', [])
                        concurrency = body.get('concurrency', 1)
                        if (not isinstance(filters, list) or
                                not all(rule in ('ext', 'prefix', 'smallVideo') for rule in filters) or
                                type(concurrency) is not int or not 1 <= concurrency <= 5):
                            raise ApiError('转存选项无效')
                        extra = (checked_fid(body.get('folderId', '0')), tuple(filters), concurrency)
                    else:
                        extra = ()
                elif kind in ('share', 'rename'):
                    if not all(isinstance(item, dict) for item in items):
                        raise ApiError('文件列表格式无效')
                    for item in items:
                        checked_fid(item.get('fid'))
                        checked_name(item.get('name'))
                    if kind == 'share':
                        expired = body.get('expiredType', 1)
                        pass_mode = body.get('passMode', 'random')
                        password = body.get('password', '')
                        if (expired not in (1, 2, 3, 4) or
                                pass_mode not in ('none', 'random', 'custom') or
                                not isinstance(password, str) or len(password) > 20 or
                                (pass_mode == 'custom' and not password.strip())):
                            raise ApiError('分享选项无效')
                        coroutine, extra = share_files, (expired, pass_mode, password)
                    else:
                        coroutine, extra = rename_files, ()
                else:
                    raise ApiError('任务类型无效')
                task_id = TASKS.create(kind, len(items))
                threading.Thread(
                    target=run_task,
                    args=(task_id, coroutine(task_id, items, *extra)), daemon=True,
                ).start()
                self.send_json({'id': task_id}, 202)
            else:
                raise ApiError('接口不存在', 404)
        except ApiError as exc:
            self.send_json({'error': str(exc)}, exc.status)
        except (ValueError, KeyError, json.JSONDecodeError) as exc:
            self.send_json({'error': str(exc)}, 400)
        except Exception as exc:
            self.send_json({'error': str(exc)}, 502)

    def send_static(self, path: str) -> None:
        dist = ROOT / 'web' / 'dist'
        target = (ROOT / 'favicon.ico') if path == '/favicon.ico' else (dist / path.lstrip('/')).resolve()
        if path == '/' or not target.is_file():
            target = dist / 'index.html'
        if (not target.is_relative_to(dist.resolve()) and target != ROOT / 'favicon.ico') or not target.is_file():
            raise ApiError('请先在 web 目录运行 npm install 和 npm run build', 404)
        mime = 'text/html' if target.suffix == '.html' else (
            'text/javascript' if target.suffix == '.js' else
            'text/css' if target.suffix == '.css' else
            'image/x-icon' if target.suffix == '.ico' else 'application/octet-stream'
        )
        content = target.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', mime + ('; charset=utf-8' if mime.startswith('text/') else ''))
        self.send_header('Content-Length', str(len(content)))
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(content)


if __name__ == '__main__':
    port = int(os.environ.get('QUARK_PORT', '8765'))
    server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    print(f'QuarkPanTool Web: http://127.0.0.1:{port}', flush=True)
    server.serve_forever()
