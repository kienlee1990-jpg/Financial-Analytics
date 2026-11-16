"""Check public import paths and startup compatibility after moving modules."""
import os
import unittest
from unittest.mock import patch
from contextlib import redirect_stdout
from io import StringIO


class StructureTests(unittest.TestCase):
    def test_legacy_imports_alias_canonical_modules(self):
        import app.api as api
        import app.services.chatbot as chat
        import webui.app as old_api
        import webui.chatbot as old_chat
        from app.wsgi import app
        self.assertIs(old_api, api)
        self.assertIs(old_chat, chat)
        self.assertIs(app, api.app)

    def test_assets_and_existing_storage_paths(self):
        from app.config import ROOT_DIR, DATA_DIR, PREDICTION_RESULTS_DIR, WORKERS_DIR
        from app.wsgi import app
        self.assertEqual(DATA_DIR, ROOT_DIR / 'data')
        self.assertEqual(PREDICTION_RESULTS_DIR, ROOT_DIR / 'webui' / 'prediction_results')
        self.assertTrue((WORKERS_DIR / 'vnstock_worker.py').is_file())
        client = app.test_client()
        for path in ['/', '/static/dashboard.js', '/static/chatbot.js', '/static/dashboard.css', '/static/icons.svg', '/static/kronos-mark.svg']:
            with self.subTest(path=path):
                self.assertEqual(client.get(path).status_code, 200)

    def test_local_launcher_still_uses_same_server_configuration(self):
        from app import cli
        from app.wsgi import app
        with patch.dict(os.environ, {'FINANCIAL_ANALYTICS_OPEN_BROWSER': '0'}), \
             patch.object(cli, 'check_dependencies', return_value=True), \
             patch('waitress.serve') as serve, \
             patch('webbrowser.open') as browser, redirect_stdout(StringIO()):
            cli.main()
        serve.assert_called_once_with(app, host='127.0.0.1', port=7070, threads=8)
        browser.assert_not_called()


if __name__ == '__main__':
    unittest.main()
