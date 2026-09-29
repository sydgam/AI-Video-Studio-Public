"""Check local BGM validation, duplicate requests, and file boundaries without GPU."""
import sys
import tempfile
import unittest
import json
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import local_bgm_service as service

class BgmTests(unittest.TestCase):
    def test_optional_duration_cap(self):
        self.assertEqual(service.bgm_settings.duration(600, False), 600)
        for value, limited in [(121, True), (601, False), (9, False), (float('nan'), False)]:
            with self.assertRaises(ValueError):
                service.bgm_settings.duration(value, limited)
    def test_vocals_are_not_forced_instrumental(self):
        options = service.bgm_settings.settings({'mode': 'vocal', 'lyrics': '[Verse]\n오늘도 노래해', 'language': 'ko', 'normalize': False})
        self.assertEqual(options['lyrics'], '[Verse]\n오늘도 노래해')
        self.assertEqual(options['mode'], 'vocal')
        self.assertFalse(options['normalize'])
        self.assertEqual(service.bgm_settings.settings({})['mode'], 'auto')

    def test_settings_and_random_seed(self):
        with tempfile.TemporaryDirectory(dir=service.ROOT / '.runtime') as directory:
            with patch.object(service, 'JOBS', Path(directory)), patch.object(service.threading, 'Thread'), patch.object(service, 'active', None), patch.object(service.bgm_settings.secrets, 'randbelow', side_effect=[123, 456]):
                first = service.generate({'prompt': 'piano', 'steps': 30, 'guidance': 5.5, 'sampler': 'heun'})
                service.active = None
                second = service.generate({'prompt': 'piano'})
                self.assertEqual((first['seed'], second['seed']), (123, 456))
                self.assertEqual((first['steps'], first['guidance'], first['sampler']), (30, 5.5, 'heun'))
                self.assertEqual(second['steps'], 50)

    def test_invalid_advanced_settings(self):
        for setting in [{'steps': 10.5}, {'guidance': float('nan')}, {'shift': 0}, {'cfgStart': 0.8, 'cfgEnd': 0.2}, {'sampler': 'bad'}, {'fadeOut': 11}]:
            with self.assertRaises(ValueError):
                service.generate({'prompt': 'piano', **setting})

    def test_worker_forwards_settings(self):
        with tempfile.TemporaryDirectory(dir=service.ROOT / '.runtime') as directory:
            folder = Path(directory)
            (folder / 'result.json').write_text('{}')
            job = dict(prompt='piano', duration=20, bpm=90, seed=456, **service.bgm_settings.settings({'steps': 30, 'sampler': 'heun'}))
            with patch.object(service.subprocess, 'run') as run, patch.object(service, 'active', job):
                run.return_value.returncode = 0
                service._run(job, folder)
                command = run.call_args.args[0]
                self.assertEqual(command[command.index('--steps') + 1], '30')
                self.assertEqual(command[command.index('--sampler') + 1], 'heun')
                self.assertEqual(command[command.index('--seed') + 1], '456')
                self.assertEqual(job['status'], 'completed')
                saved = json.loads((folder / 'settings.json').read_text(encoding='utf-8'))
                self.assertEqual(saved['mode'], 'auto')
                self.assertEqual(saved['sampler'], 'heun')

    def test_invalid_settings_never_launch(self):
        for data in [[], {'prompt': ''}, {'prompt': 'x', 'duration': 200}, {'prompt': 'x', 'seed': -1}]:
            with self.assertRaises(ValueError):
                service.generate(data)

    def test_duplicate_request(self):
        with patch.object(service, 'active', {'id': 'existing'}):
            with self.assertRaises(RuntimeError):
                service.generate({'prompt': 'piano'})

    def test_job_saved_and_completed_audio_confined(self):
        with tempfile.TemporaryDirectory(dir=service.ROOT / '.runtime') as directory:
            with patch.object(service, 'JOBS', Path(directory)), patch.object(service.threading, 'Thread'), patch.object(service, 'active', None):
                job = service.generate({'prompt': 'piano', 'duration': 20, 'bpm': 90})
                folder = Path(directory) / job['id']
                self.assertEqual(json.loads((folder / 'job.json').read_text())['prompt'], 'piano')
                audio = folder / 'music.wav'; audio.write_bytes(b'RIFF')
                (folder / 'result.json').write_text(json.dumps({'audio': str(audio)}))
                self.assertEqual(service.read_job(folder)['status'], 'completed')
                self.assertEqual(service.audio_file(job['id']), audio.resolve())
                (folder / 'result.json').write_text(json.dumps({'audio': str(service.ROOT / '.env')}))
                with self.assertRaises(ValueError):
                    service.audio_file(job['id'])

    def test_path_traversal_rejected(self):
        with self.assertRaises(ValueError):
            service.audio_file('../../.env')

if __name__ == '__main__':
    unittest.main()
