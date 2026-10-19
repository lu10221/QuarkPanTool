import asyncio
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, Mock, patch

from quark_login import QuarkLogin
from web_app import (ApiError, TaskStore, delete_file, filter_share_items, parse_share_link,
                     download_links, run_task, safe_name, save_links, share_files)


class CookieTests(unittest.TestCase):
    def test_reads_old_and_new_cookie_formats(self):
        cookies = [{'domain': '.quark.cn', 'name': '__puus', 'value': 'test'}]
        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory) / 'cookies.txt'
            with patch('quark_login.CONFIG_DIR', directory):
                for content in (str(cookies), json.dumps(cookies)):
                    file.write_text(content, encoding='utf-8')
                    self.assertEqual(QuarkLogin().check_cookies(), {'__puus': 'test'})

    def test_cookie_file_is_parsed_not_executed(self):
        with tempfile.TemporaryDirectory() as directory:
            marker = Path(directory) / 'executed'
            (Path(directory) / 'cookies.txt').write_text(
                f"[__import__('pathlib').Path({str(marker)!r}).touch()]", encoding='utf-8',
            )
            with patch('quark_login.CONFIG_DIR', directory):
                self.assertIsNone(QuarkLogin().check_cookies())
            self.assertFalse(marker.exists())


class WebAppTests(unittest.TestCase):
    def test_delete_uses_real_file_api_and_validated_id(self):
        response = Mock()
        response.json.return_value = {'code': 0, 'data': {'task_id': 'delete-task'}}
        client = Mock()
        client.post = AsyncMock(return_value=response)
        context = Mock()
        context.__aenter__ = AsyncMock(return_value=client)
        context.__aexit__ = AsyncMock(return_value=None)
        with patch('web_app.httpx.AsyncClient', return_value=context), \
                patch('web_app.poll_save', new=AsyncMock()) as poll:
            asyncio.run(delete_file(Mock(headers={'cookie': 'test'}), 'file-id'))
        poll.assert_awaited_once()
        self.assertEqual(client.post.await_args.kwargs['json'], {
            'action_type': 2, 'filelist': ['file-id'], 'exclude_fids': [],
        })
        with self.assertRaises(ApiError):
            asyncio.run(delete_file(Mock(headers={}), '../invalid'))

    def test_share_links_are_limited_to_quark(self):
        self.assertEqual(parse_share_link('https://pan.quark.cn/s/abc123?pwd=9876'), ('abc123', '9876'))
        for url in ('http://pan.quark.cn/s/abc', 'https://evil.example/s/abc',
                    'https://pan.quark.cn/other/abc'):
            with self.assertRaises(ApiError):
                parse_share_link(url)

    def test_local_names_cannot_traverse_or_use_reserved_devices(self):
        self.assertEqual(safe_name('a/b\\c.txt'), 'a_b_c.txt')
        for name in ('..', 'CON', 'NUL.txt'):
            with self.assertRaises(ApiError):
                safe_name(name)

    def test_task_snapshot_is_not_mutable(self):
        store = TaskStore()
        task_id = store.create('save', 1)
        store.record(task_id, 'done', {'label': 'x', 'status': 'ok'})
        snapshot = store.get(task_id)
        snapshot['results'].clear()
        self.assertEqual(store.get(task_id)['current'], 1)
        self.assertEqual(len(store.get(task_id)['results']), 1)

    def test_task_state_distinguishes_partial_and_total_failure(self):
        for statuses, expected in (
            (['ok', 'error'], 'partial'),
            (['skipped', 'error'], 'partial'),
            (['error', 'error'], 'error'),
            (['ok', 'skipped'], 'done'),
        ):
            with self.subTest(statuses=statuses):
                store = TaskStore()
                task_id = store.create('save', len(statuses))
                for status in statuses:
                    store.record(task_id, status, {'label': status, 'status': status})
                with patch('web_app.TASKS', store):
                    run_task(task_id, asyncio.sleep(0))
                self.assertEqual(store.get(task_id)['state'], expected)

        store = TaskStore()
        task_id = store.create('save', 2)
        store.record(task_id, 'done', {'label': 'first', 'status': 'ok'})
        with patch('web_app.TASKS', store):
            run_task(task_id, asyncio.sleep(0))
        self.assertEqual(store.get(task_id)['state'], 'partial')

    def test_save_task_uses_real_share_metadata(self):
        store = TaskStore()
        task_id = store.create('save', 1)
        fake = Mock()
        fake.get_stoken = AsyncMock(return_value='token')
        fake.get_detail = AsyncMock(return_value=(0, [
            {'fid': 'file-id', 'share_fid_token': 'file-token'},
        ]))
        fake.get_share_save_task_id = AsyncMock(return_value='task-id')
        with patch('web_app.TASKS', store), patch('web_app.manager', return_value=fake), \
                patch('web_app.poll_save', new=AsyncMock()) as poll:
            asyncio.run(save_links(task_id, ['https://pan.quark.cn/s/abc123'], '0'))
        fake.get_share_save_task_id.assert_awaited_once_with(
            'abc123', 'token', ['file-id'], ['file-token'], '0',
        )
        poll.assert_awaited_once_with(fake, 'task-id')
        self.assertEqual(store.get(task_id)['results'][0]['status'], 'ok')

    def test_filters_only_direct_share_files(self):
        items = [
            {'fid': 'folder', 'dir': True, 'file_name': '推广文件夹'},
            {'fid': 'ad', 'file_name': '广告.txt'},
            {'fid': 'prefix', 'file_name': '【公众号：影视】正片.mkv', 'size': 20000000},
            {'fid': 'small', 'file_name': '预告.mp4', 'size': 1000000},
            {'fid': 'unknown', 'file_name': '未知大小.mp4'},
            {'fid': 'movie', 'file_name': '正片.mkv', 'size': 20000000},
        ]
        kept, filtered = filter_share_items(items, {'ext', 'prefix', 'smallVideo'})
        self.assertEqual([item['fid'] for item in kept], ['folder', 'unknown', 'movie'])
        self.assertEqual(filtered, 3)

    def test_save_task_applies_selected_filters(self):
        store = TaskStore()
        task_id = store.create('save', 1)
        fake = Mock()
        fake.get_stoken = AsyncMock(return_value='token')
        fake.get_detail = AsyncMock(return_value=(0, [
            {'fid': 'ad', 'share_fid_token': 'ad-token', 'file_name': '广告.txt'},
            {'fid': 'movie', 'share_fid_token': 'movie-token', 'file_name': '正片.mkv'},
        ]))
        fake.get_share_save_task_id = AsyncMock(return_value='task-id')
        with patch('web_app.TASKS', store), patch('web_app.manager', return_value=fake), \
                patch('web_app.poll_save', new=AsyncMock()):
            asyncio.run(save_links(task_id, ['https://pan.quark.cn/s/abc123'], '0', ('ext',), 2))
        fake.get_share_save_task_id.assert_awaited_once_with(
            'abc123', 'token', ['movie'], ['movie-token'], '0',
        )
        self.assertEqual(store.get(task_id)['results'][0]['filtered'], 1)

    def test_save_task_respects_concurrency(self):
        store = TaskStore()
        task_id = store.create('save', 2)
        active = 0
        peak = 0

        async def get_stoken(*_):
            nonlocal active, peak
            active += 1
            peak = max(peak, active)
            await asyncio.sleep(0.01)
            active -= 1
            return 'token'

        fake = Mock()
        fake.get_stoken = AsyncMock(side_effect=get_stoken)
        fake.get_detail = AsyncMock(return_value=(0, [
            {'fid': 'movie', 'share_fid_token': 'movie-token'},
        ]))
        fake.get_share_save_task_id = AsyncMock(return_value='task-id')
        links = ['https://pan.quark.cn/s/abc123', 'https://pan.quark.cn/s/def456']
        with patch('web_app.TASKS', store), patch('web_app.manager', return_value=fake), \
                patch('web_app.poll_save', new=AsyncMock()):
            asyncio.run(save_links(task_id, links, '0', (), 2))
        self.assertEqual(peak, 2)
        self.assertEqual(store.get(task_id)['current'], 2)

    def test_random_share_requests_private_link_without_fixed_code(self):
        store = TaskStore()
        task_id = store.create('share', 1)
        fake = Mock()
        fake.get_share_task_id = AsyncMock(return_value='task-id')
        fake.get_share_id = AsyncMock(return_value='share-id')
        fake.submit_share = AsyncMock(return_value=('https://pan.quark.cn/s/abc?pwd=1234', 'Folder'))
        with patch('web_app.TASKS', store), patch('web_app.manager', return_value=fake):
            asyncio.run(share_files(task_id, [{'fid': 'folder-id', 'name': 'Folder'}], 1, 'random', ''))
        fake.get_share_task_id.assert_awaited_once_with(
            'folder-id', 'Folder', url_type=2, expired_type=1, password='',
        )
        self.assertIn('pwd=1234', store.get(task_id)['results'][0]['url'])

    def test_concurrent_downloads_keep_distinct_complete_files(self):
        async def download_both(root):
            arrived = asyncio.Event()
            streams = 0

            class FakeStream:
                async def __aenter__(self):
                    return self

                async def __aexit__(self, *_):
                    pass

                def raise_for_status(self):
                    pass

                async def aiter_bytes(self):
                    nonlocal streams
                    streams += 1
                    stream_id = streams
                    if streams == 2:
                        arrived.set()
                    await asyncio.wait_for(arrived.wait(), 2)
                    yield f'content-{stream_id}'.encode()

            class FakeClient:
                async def __aenter__(self):
                    return self

                async def __aexit__(self, *_):
                    pass

                async def post(self, *_args, **_kwargs):
                    response = Mock()
                    response.json.return_value = {'code': 0, 'data': [{'download_url': 'https://example.test/file'}]}
                    return response

                def stream(self, *_args, **_kwargs):
                    return FakeStream()

            fake = Mock(headers={'user-agent': 'test'})
            fake.get_stoken = AsyncMock(return_value='token')
            fake.get_detail = AsyncMock(return_value=(1, [
                {'fid': 'file-id', 'dir': False, 'file_name': 'video.mp4'},
            ]))
            store = TaskStore()
            ids = [store.create('download', 1) for _ in range(2)]
            with patch('web_app.ROOT', root), patch('web_app.TASKS', store), \
                    patch('web_app.manager', return_value=fake), \
                    patch('web_app.httpx.AsyncClient', return_value=FakeClient()):
                await asyncio.gather(*(download_links(task_id, ['https://pan.quark.cn/s/abc123'])
                                       for task_id in ids))
            return [store.get(task_id)['results'][0]['status'] for task_id in ids]

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            statuses = asyncio.run(download_both(root))
            files = sorted((root / 'downloads').iterdir())
            self.assertEqual(statuses, ['ok', 'ok'])
            self.assertEqual([file.name for file in files], ['video (2).mp4', 'video.mp4'])
            self.assertEqual({file.read_bytes() for file in files}, {b'content-1', b'content-2'})


if __name__ == '__main__':
    unittest.main()
