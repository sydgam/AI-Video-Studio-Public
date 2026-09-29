import sys
import unittest
from pathlib import Path
from unittest.mock import patch, Mock
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'local-tts'))
import app

class QueueTests(unittest.TestCase):
    def test_stereo_reference_is_converted_before_qwen_receives_it(self):
        class Stereo:
            ndim = 2
            def mean(self, axis):
                self.axis = axis
                return Mono()

        class Mono:
            ndim = 1
            def astype(self, dtype):
                self.dtype = dtype
                return self

        source = Stereo()
        normalized = app.normalize_reference_audio(source)
        self.assertEqual(source.axis, -1)
        self.assertEqual(normalized.ndim, 1)
        self.assertEqual(normalized.dtype, 'float32')

    def test_design_ignores_preset_speaker(self):
        model = Mock()
        model.generate_voice_design.return_value = ([[0.0] * 240], 24000)
        with patch.object(app, 'get_model', return_value=model) as loader:
            app.generate(app.GenerateRequest(text='안녕하세요.', mode='design', speaker='Sohee', instruct='낮은 남성 목소리'))
        loader.assert_called_once_with('Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign')
        model.generate_voice_design.assert_called_once_with(text='안녕하세요.', language='Korean', instruct='낮은 남성 목소리')
        model.generate_custom_voice.assert_not_called()

    def test_busy_request_does_not_wait_or_load_another_model(self):
        app.model_lock.acquire()
        try:
            with patch.object(app, 'get_model') as loader:
                with self.assertRaises(app.HTTPException) as error:
                    app.generate(app.GenerateRequest(text='test'))
                self.assertEqual(error.exception.status_code, 409)
                loader.assert_not_called()
        finally:
            app.model_lock.release()

    def test_load_failure_releases_lock_for_retry(self):
        with patch.object(app, 'get_model', side_effect=RuntimeError('test failure')):
            with self.assertRaises(app.HTTPException):
                app.generate(app.GenerateRequest(text='test'))
        self.assertFalse(app.model_lock.locked())
        self.assertEqual(app.stage, 'idle')

    def test_empty_installation_is_not_ready(self):
        with patch.object(app, 'installed_models', return_value=[]):
            self.assertFalse(app.health()['ready'])

if __name__ == '__main__':
    unittest.main()
