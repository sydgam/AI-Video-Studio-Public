import json
import local_bgm_service
import os
import base64
import binascii
import getpass
import hashlib
import mimetypes
import re
import secrets
import subprocess
import threading
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
import io
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

HOST = "127.0.0.1"
PORT = int(os.environ.get("AI_VIDEO_STUDIO_PORT", "8000"))
OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"
OPENAI_IMAGES_URL = "https://api.openai.com/v1/images/generations"
OPENAI_IMAGE_EDITS_URL = "https://api.openai.com/v1/images/edits"
ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages"
GEMINI_GENERATE_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
GEMINI_INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions"
GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
SEEDREAM_GENERATE_URL = "https://ark.ap-southeast.bytepluses.com/api/v3/images/generations"
ALLOWED_MODELS = {"gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"}
ANTHROPIC_MODELS = {"claude-fable-5", "claude-opus-5", "claude-sonnet-5", "claude-haiku-4-5"}
GEMINI_TEXT_MODELS = {"gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"}
IMAGE_MODELS = {
    "gpt-image-2.5-flare": {"provider": "openai", "api_model": "gpt-image-2.5-flare", "resolutions": {"1K", "2K", "4K"}, "formats": {"png", "jpeg", "webp"}, "max_references": 16},
    "gpt-image-2.5-sunburst": {"provider": "openai", "api_model": "gpt-image-2.5-sunburst", "resolutions": {"1K", "2K", "4K"}, "formats": {"png", "jpeg", "webp"}, "max_references": 16},
    "gpt-image-2": {"provider": "openai", "api_model": "gpt-image-2", "resolutions": {"1K", "2K", "4K"}, "formats": {"png", "jpeg", "webp"}, "max_references": 16},
    "nano-banana-2": {"provider": "google", "api_model": "gemini-3.1-flash-image", "resolutions": {"0.5K", "1K", "2K", "4K"}, "formats": {"jpeg"}, "max_references": 14},
    "nano-banana-2-lite": {"provider": "google", "api_model": "gemini-3.1-flash-lite-image", "resolutions": {"1K"}, "formats": {"jpeg"}, "max_references": 14},
    "nano-banana-pro": {"provider": "google", "api_model": "gemini-3-pro-image", "resolutions": {"1K", "2K", "4K"}, "formats": {"jpeg"}, "max_references": 14},
    "seedream-5-pro": {"provider": "byteplus", "api_model": "dola-seedream-5-0-pro-260628", "resolutions": {"1K", "2K"}, "formats": {"png", "jpeg"}, "max_references": 10},
}
ALLOWED_EFFORTS = {"none", "low", "medium", "high", "xhigh", "max"}
ALLOWED_VERBOSITY = {"low", "medium", "high"}
ALLOWED_ASPECT_RATIOS = {"9:16", "16:9", "4:3", "3:4", "1:1"}
ALLOWED_IMAGE_FORMATS = {"png", "jpeg", "webp"}
MAX_BODY_SIZE = 200 * 1024 * 1024
PROJECTS_ROOT = Path(__file__).resolve().parent / "projects"
ENV_FILE = Path(__file__).resolve().parent / ".env"
VERSION_FILE = Path(__file__).resolve().parent / "VERSION"
UPDATES_ROOT = Path(__file__).resolve().parent / "updates"
GENERATED_VIDEOS_ROOT = PROJECTS_ROOT / "_generated-videos"
API_KEY_NAMES = ("OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "ARK_API_KEY", "APIFRAME_API_KEY", "WAVESPEED_API_KEY")
UPDATE_ENV_NAMES = ("GITHUB_UPDATE_TOKEN", "GITHUB_UPDATE_REPOSITORY")
APIFRAME_BASE_URL = "https://api.apiframe.ai/v2"
WAVESPEED_BASE_URL = "https://api.wavespeed.ai/api/v3"
WAVESPEED_VIDEO_MODELS = {
    "seedance-2.5-spicy": "bytedance/seedance-2.5/image-to-video-spicy",
    "seedance-2.5": "bytedance/seedance-2.5/image-to-video",
    "seedance-2.0-fast-spicy": "bytedance/seedance-2.0-fast/image-to-video-spicy",
    "seedance-2.0-fast": "bytedance/seedance-2.0-fast/image-to-video",
    "seedance-2.0-mini": "bytedance/seedance-2.0-mini/image-to-video",
    "seedance-2.0-mini-spicy": "bytedance/seedance-2.0-mini/image-to-video-spicy",
    "kling-v3-turbo-std": "kwaivgi/kling-v3-turbo-std/image-to-video",
    "kling-v3-turbo-pro": "kwaivgi/kling-v3-turbo-pro/image-to-video",
    "kling-v2.6-std": "kwaivgi/kling-v2.6-std/image-to-video",
    "kling-v2.6-pro": "kwaivgi/kling-v2.6-pro/image-to-video",
}
WAVESPEED_MULTI_REFERENCE_MODELS = {
    "seedance-2.5-spicy": "bytedance/seedance-2.5/text-to-video",
    "seedance-2.5": "bytedance/seedance-2.5/text-to-video",
    "seedance-2.0-fast-spicy": "bytedance/seedance-2.0-fast/text-to-video",
    "seedance-2.0-fast": "bytedance/seedance-2.0-fast/text-to-video",
    "seedance-2.0-mini": "bytedance/seedance-2.0-mini/text-to-video",
    "seedance-2.0-mini-spicy": "bytedance/seedance-2.0-mini/text-to-video",
}
GOOGLE_ENV_NAMES = ("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN")
PROJECT_FILE_ROOTS = {"img", "planning", "storyboard"}
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_DOCS_SCOPE = "https://www.googleapis.com/auth/documents.readonly"
GOOGLE_OAUTH_STATES = set()


class CurlResponse:
    def __init__(self, status, body, headers=None):
        self.status = status
        self._body = body
        self.headers = headers or {}

    def read(self):
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return False


def curl_urlopen(request, timeout=60):
    url = request.full_url if isinstance(request, urllib.request.Request) else str(request)
    method = request.get_method() if isinstance(request, urllib.request.Request) else "GET"
    data = request.data if isinstance(request, urllib.request.Request) else None
    headers = request.header_items() if isinstance(request, urllib.request.Request) else []
    with tempfile.TemporaryDirectory(prefix="ai-video-studio-http-") as temporary_dir:
        body_path = Path(temporary_dir) / "response.bin"
        header_path = Path(temporary_dir) / "headers.txt"
        request_headers_path = Path(temporary_dir) / "request-headers.txt"
        command = [
            "curl.exe", "--silent", "--show-error", "--location",
            "--max-time", str(max(1, int(timeout))), "--request", method,
            "--dump-header", str(header_path), "--output", str(body_path),
            "--write-out", "%{http_code}",
        ]
        if headers:
            request_headers_path.write_text(
                "\n".join(f"{name}: {value}" for name, value in headers),
                encoding="utf-8",
            )
            command.extend(["--header", f"@{request_headers_path}"])
        if data is not None:
            request_path = Path(temporary_dir) / "request.bin"
            request_path.write_bytes(data)
            command.extend(["--data-binary", f"@{request_path}"])
        command.append(url)
        completed = subprocess.run(command, capture_output=True, text=True, timeout=timeout + 10)
        if completed.returncode != 0:
            raise urllib.error.URLError(completed.stderr.strip() or f"curl error {completed.returncode}")
        status_text = completed.stdout.strip()[-3:]
        status = int(status_text) if status_text.isdigit() else 0
        body = body_path.read_bytes() if body_path.exists() else b""
        if status >= 400:
            raise urllib.error.HTTPError(url, status, "HTTP request failed", {}, io.BytesIO(body))
        return CurlResponse(status, body)


def safe_urlopen(request, timeout=60):
    try:
        return urllib.request.urlopen(request, timeout=timeout)
    except urllib.error.URLError as error:
        reason = getattr(error, "reason", None)
        if getattr(reason, "winerror", None) != 10013:
            raise
        print("Python HTTPS socket blocked (WinError 10013); retrying with Windows curl.")
        return curl_urlopen(request, timeout)


def safe_project_name(value):
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "-", str(value or "project")).strip(" .")
    name = re.sub(r"\s+", " ", name)[:100]
    return name or "project"


def project_directory(project_name):
    PROJECTS_ROOT.mkdir(parents=True, exist_ok=True)
    return (PROJECTS_ROOT / safe_project_name(project_name)).resolve()


def collect_web_sources(value):
    sources = []
    seen = set()

    def visit(item):
        if isinstance(item, dict):
            url = item.get("url") or item.get("uri")
            if isinstance(url, str) and url.startswith(("http://", "https://")) and url not in seen:
                seen.add(url)
                sources.append({
                    "url": url,
                    "title": str(item.get("title") or item.get("name") or url),
                })
            for nested in item.values():
                visit(nested)
        elif isinstance(item, list):
            for nested in item:
                visit(nested)

    visit(value)
    return sources[:30]


def safe_project_file(project_name, relative_path):
    if not isinstance(project_name, str) or not project_name.strip():
        raise ValueError("프로젝트 이름이 필요합니다.")
    root = project_directory(project_name)
    normalized = str(relative_path or "").replace("\\", "/").strip("/")
    if not normalized:
        raise ValueError("파일 경로가 비어 있습니다.")
    parts = Path(normalized).parts
    if ".." in parts or Path(normalized).is_absolute():
        raise ValueError("프로젝트 폴더 밖의 경로는 사용할 수 없습니다.")
    if len(parts) > 1 and parts[0] not in PROJECT_FILE_ROOTS:
        raise ValueError("지원하지 않는 프로젝트 파일 경로입니다.")
    if len(parts) == 1 and parts[0] != "project.json":
        raise ValueError("프로젝트 루트에는 project.json만 저장할 수 있습니다.")
    target = (root / Path(*parts)).resolve()
    if root not in target.parents:
        raise ValueError("프로젝트 폴더 밖의 경로는 사용할 수 없습니다.")
    return root, target


def load_env_file():
    if not ENV_FILE.is_file():
        return
    try:
        for raw_line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            name, value = line.split("=", 1)
            name = name.strip()
            value = value.strip()
            if name not in (*API_KEY_NAMES, *GOOGLE_ENV_NAMES, *UPDATE_ENV_NAMES):
                continue
            if value.startswith('"') and value.endswith('"'):
                try:
                    value = json.loads(value)
                except json.JSONDecodeError:
                    value = value[1:-1]
            if value:
                os.environ.setdefault(name, value)
    except OSError as error:
        print(f".env 파일을 읽지 못했습니다: {error}")


def save_env_file():
    lines = [
        "# AI Video Studio local API keys",
        "# Do not share or commit this file.",
    ]
    for name in (*API_KEY_NAMES, *GOOGLE_ENV_NAMES, *UPDATE_ENV_NAMES):
        value = os.environ.get(name, "").strip()
        if value:
            lines.append(f"{name}={json.dumps(value)}")
    temporary = ENV_FILE.with_name(".env.tmp")
    temporary.write_text("\n".join(lines) + "\n", encoding="utf-8")
    temporary.replace(ENV_FILE)


def create_openai_edit_multipart(fields, reference_images):
    boundary = f"----AIVideoStudio{secrets.token_hex(16)}"
    body = bytearray()

    def append(value):
        body.extend(value.encode("utf-8") if isinstance(value, str) else value)

    for name, value in fields.items():
        append(f"--{boundary}\r\n")
        append(f'Content-Disposition: form-data; name="{name}"\r\n\r\n')
        append(f"{value}\r\n")

    for index, reference in enumerate(reference_images):
        header, encoded = reference["dataUrl"].split(",", 1)
        mime_type = header.split(":", 1)[1].split(";", 1)[0]
        image_bytes = base64.b64decode(encoded, validate=True)
        extension = mime_type.split("/")[-1].replace("jpeg", "jpg")
        original_name = str(reference.get("name") or f"reference-{index + 1}.{extension}")
        filename = original_name.replace('"', "").replace("\r", "").replace("\n", "")
        append(f"--{boundary}\r\n")
        append(
            f'Content-Disposition: form-data; name="image[]"; filename="{filename}"\r\n'
        )
        append(f"Content-Type: {mime_type}\r\n\r\n")
        append(image_bytes)
        append("\r\n")

    append(f"--{boundary}--\r\n")
    return bytes(body), f"multipart/form-data; boundary={boundary}"


class SingleInstanceHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = False


class AppHandler(SimpleHTTPRequestHandler):
    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def apiframe_request(self, path, method="GET", payload=None):
        api_key = os.environ.get("APIFRAME_API_KEY", "").strip()
        if not api_key:
            raise ValueError("서버에 APIFRAME_API_KEY가 설정되지 않았습니다.")
        request = urllib.request.Request(
            f"{APIFRAME_BASE_URL}{path}",
            data=None if payload is None else json.dumps(payload).encode("utf-8"),
            headers={
                "X-API-Key": api_key,
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "AI-Video-Studio/1.0 (+local-app)",
            },
            method=method,
        )
        with safe_urlopen(request, timeout=180) as response:
            return response.status, json.loads(response.read().decode("utf-8"))

    def wavespeed_request(self, path, method="GET", payload=None, timeout=60):
        api_key = os.environ.get("WAVESPEED_API_KEY", "").strip()
        if not api_key:
            raise ValueError("서버에 WAVESPEED_API_KEY가 설정되지 않았습니다.")
        request = urllib.request.Request(
            f"{WAVESPEED_BASE_URL}{path}",
            data=None if payload is None else json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "AI-Video-Studio/1.0 (+local-app)",
            },
            method=method,
        )
        with safe_urlopen(request, timeout=timeout) as response:
            return response.status, json.loads(response.read().decode("utf-8"))

    def gemini_api_request(self, path, method="GET", payload=None, timeout=600):
        api_key = os.environ.get("GEMINI_API_KEY", "").strip()
        if not api_key:
            raise ValueError("서버에 GEMINI_API_KEY가 설정되지 않았습니다.")
        separator = "&" if "?" in path else "?"
        request = urllib.request.Request(
            f"{GEMINI_API_BASE_URL}{path}{separator}key={urllib.parse.quote(api_key)}",
            data=None if payload is None else json.dumps(payload).encode("utf-8"),
            headers={
                "x-goog-api-key": api_key,
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "AI-Video-Studio/1.1 (+local-app)",
            },
            method=method,
        )
        with safe_urlopen(request, timeout=timeout) as response:
            return response.status, json.loads(response.read().decode("utf-8"))

    @staticmethod
    def decode_video_image(image, index):
        data_url = str((image or {}).get("dataUrl") or "")
        match = re.fullmatch(r"data:(image/[A-Za-z0-9.+-]+);base64,(.+)", data_url, re.DOTALL)
        if not match:
            raise ValueError(f"이미지 {index} 데이터가 올바르지 않습니다.")
        mime_type, encoded = match.groups()
        try:
            image_bytes = base64.b64decode(encoded, validate=True)
        except binascii.Error as error:
            raise ValueError(f"이미지 {index} 데이터가 손상되었습니다.") from error
        if not image_bytes or len(image_bytes) > 20 * 1024 * 1024:
            raise ValueError(f"이미지 {index}는 20MB 이하여야 합니다.")
        return {"inlineData": {"mimeType": mime_type, "data": encoded}}

    @staticmethod
    def save_generated_video(video_bytes):
        if not video_bytes:
            raise ValueError("Google 응답에 영상 데이터가 없습니다.")
        GENERATED_VIDEOS_ROOT.mkdir(parents=True, exist_ok=True)
        name = f"google-video-{secrets.token_hex(12)}.mp4"
        (GENERATED_VIDEOS_ROOT / name).write_bytes(video_bytes)
        return f"/api/generated-video?name={urllib.parse.quote(name)}"

    def handle_google_video_generate(self, request_data):
        try:
            model_key = str(request_data.get("model") or "").strip()
            model_ids = {
                "gemini-omni-1.1-flash": "gemini-omni-1.1-flash",
                "veo-3.1": "veo-3.1-generate-preview",
                "veo-3.1-fast": "veo-3.1-fast-generate-preview",
            }
            model_id = model_ids.get(model_key)
            if not model_id:
                raise ValueError("지원하지 않는 Google 영상 모델입니다.")
            prompt = str(request_data.get("prompt") or "").strip()
            if not prompt:
                raise ValueError("영상 프롬프트가 비어 있습니다.")
            images = request_data.get("images") or []
            if not isinstance(images, list):
                raise ValueError("영상 참조 이미지 형식이 올바르지 않습니다.")
            aspect_ratio = str(request_data.get("aspectRatio") or "16:9")
            if aspect_ratio not in {"16:9", "9:16"}:
                raise ValueError("Google 영상 모델은 16:9 또는 9:16 비율을 지원합니다.")
            inline_images = [self.decode_video_image(image, index + 1) for index, image in enumerate(images)]

            if model_key == "gemini-omni-1.1-flash":
                if len(inline_images) > 2:
                    raise ValueError("Gemini Omni 1.1 Flash는 이미지 입력을 최대 2장까지 사용합니다.")
                resolution = str(request_data.get("resolution") or "720p")
                if resolution not in {"360p", "720p", "1080p", "4k"}:
                    raise ValueError("Omni가 지원하지 않는 해상도입니다.")
                input_value = prompt if not inline_images else [
                    *[{"type": "image", "data": item["inlineData"]["data"], "mime_type": item["inlineData"]["mimeType"]} for item in inline_images],
                    {"type": "text", "text": prompt},
                ]
                _, result = self.gemini_api_request("/interactions", "POST", {
                    "model": model_id,
                    "input": input_value,
                    "response_format": {"type": "video", "aspect_ratio": aspect_ratio, "resolution": resolution},
                }, timeout=900)
                video_content = None
                for step in reversed(result.get("steps") or []):
                    for content in step.get("content") or []:
                        if content.get("type") == "video" and content.get("data"):
                            video_content = content
                            break
                    if video_content:
                        break
                if not video_content:
                    raise ValueError("Omni 응답에서 생성 영상을 찾지 못했습니다.")
                video_url = self.save_generated_video(base64.b64decode(video_content["data"]))
                self.send_json(200, {
                    "id": result.get("id") or secrets.token_hex(8),
                    "status": "completed",
                    "model": model_key,
                    "mode": "text-to-video" if not inline_images else ("first-frame" if len(inline_images) == 1 else "first-last-frame"),
                    "effectiveModel": model_id,
                    "imageCount": len(inline_images),
                    "videoUrl": video_url,
                })
                return

            if len(inline_images) > 3:
                raise ValueError("Veo 3.1은 참조 이미지를 최대 3장까지 사용합니다.")
            resolution = str(request_data.get("resolution") or "720p")
            duration = int(request_data.get("duration") or 8)
            if resolution not in {"720p", "1080p", "4k"} or duration not in {4, 6, 8}:
                raise ValueError("Veo 해상도 또는 길이 설정이 올바르지 않습니다.")
            reference_mode = str(request_data.get("referenceMode") or "auto")
            if resolution in {"1080p", "4k"}:
                duration = 8
            instance = {"prompt": prompt}
            mode = "text-to-video"
            if inline_images:
                if reference_mode == "references":
                    instance["referenceImages"] = [
                        {"image": image, "referenceType": "asset"} for image in inline_images[:3]
                    ]
                    duration = 8
                    mode = "reference-images"
                elif reference_mode == "first-last" or (reference_mode == "auto" and len(inline_images) == 2):
                    if len(inline_images) < 2:
                        raise ValueError("첫·마지막 프레임 모드에는 이미지 2장이 필요합니다.")
                    instance["image"] = inline_images[0]
                    instance["lastFrame"] = inline_images[1]
                    mode = "first-last-frame"
                else:
                    instance["image"] = inline_images[0]
                    mode = "first-frame"
            parameters = {"aspectRatio": aspect_ratio, "durationSeconds": duration, "resolution": resolution}
            _, result = self.gemini_api_request(
                f"/models/{model_id}:predictLongRunning", "POST",
                {"instances": [instance], "parameters": parameters}, timeout=180,
            )
            operation_name = str(result.get("name") or "")
            if not operation_name:
                raise ValueError("Veo가 작업 ID를 반환하지 않았습니다.")
            self.send_json(200, {
                "id": operation_name,
                "status": "processing",
                "model": model_key,
                "mode": mode,
                "effectiveModel": model_id,
                "imageCount": len(inline_images),
                "duration": duration,
                "resolution": resolution,
            })
        except ValueError as error:
            self.send_json(400 if "GEMINI_API_KEY" not in str(error) else 503, {"error": str(error)})
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            try:
                parsed = json.loads(detail)
                message = parsed.get("error", {}).get("message") or detail
            except json.JSONDecodeError:
                message = detail
            self.send_json(error.code, {"error": f"Google 영상 API 오류: {message}"})
        except (urllib.error.URLError, TimeoutError, OSError, binascii.Error) as error:
            self.send_json(502, {"error": f"Google 영상 연결 오류: {error}"})

    def handle_google_video_operation(self):
        try:
            query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            operation_name = str((query.get("id") or [""])[0]).strip().strip("/")
            if not operation_name or not re.fullmatch(r"[A-Za-z0-9._/-]+", operation_name):
                raise ValueError("Veo 작업 ID가 올바르지 않습니다.")
            _, result = self.gemini_api_request(f"/{operation_name}", timeout=120)
            if not result.get("done"):
                self.send_json(200, {"status": "processing", "done": False})
                return
            if result.get("error"):
                self.send_json(200, {"status": "failed", "done": True, "error": result["error"]})
                return
            samples = (((result.get("response") or {}).get("generateVideoResponse") or {}).get("generatedSamples") or [])
            video_uri = str((((samples[0] if samples else {}).get("video") or {}).get("uri") or ""))
            if not video_uri:
                raise ValueError("완료된 Veo 작업에서 영상 주소를 찾지 못했습니다.")
            api_key = os.environ.get("GEMINI_API_KEY", "").strip()
            download_request = urllib.request.Request(video_uri, headers={"x-goog-api-key": api_key})
            with safe_urlopen(download_request, timeout=300) as response:
                video_url = self.save_generated_video(response.read())
            self.send_json(200, {"status": "completed", "done": True, "outputs": [video_url]})
        except ValueError as error:
            self.send_json(400, {"error": str(error)})
        except urllib.error.HTTPError as error:
            self.send_json(error.code, {"error": f"Veo 작업 조회 오류 ({error.code})"})
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            self.send_json(502, {"error": f"Veo 작업 조회 연결 오류: {error}"})

    def handle_generated_video(self):
        query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        name = str((query.get("name") or [""])[0])
        if not re.fullmatch(r"google-video-[a-f0-9]{24}\.mp4", name):
            self.send_json(404, {"error": "영상 파일을 찾을 수 없습니다."})
            return
        target = GENERATED_VIDEOS_ROOT / name
        if not target.is_file():
            self.send_json(404, {"error": "영상 파일을 찾을 수 없습니다."})
            return
        total = target.stat().st_size
        start, end = 0, total - 1
        status = 200
        range_header = self.headers.get("Range", "")
        match = re.fullmatch(r"bytes=(\d*)-(\d*)", range_header)
        if match:
            if match.group(1):
                start = int(match.group(1))
            if match.group(2):
                end = min(int(match.group(2)), end)
            if start > end or start >= total:
                self.send_error(416)
                return
            status = 206
        length = end - start + 1
        self.send_response(status)
        self.send_header("Content-Type", "video/mp4")
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(length))
        if status == 206:
            self.send_header("Content-Range", f"bytes {start}-{end}/{total}")
        self.send_header("Cache-Control", "private, max-age=86400")
        self.end_headers()
        with target.open("rb") as video_file:
            video_file.seek(start)
            self.wfile.write(video_file.read(length))

    def handle_wavespeed_video_generate(self, request_data):
        try:
            model_key = str(request_data.get("model") or "seedance-2.0-mini")
            model_id = WAVESPEED_VIDEO_MODELS.get(model_key)
            if not model_id:
                raise ValueError("지원하지 않는 영상 모델입니다.")
            is_kling = model_key.startswith("kling-")
            prompt = str(request_data.get("prompt") or "").strip()
            if not prompt:
                raise ValueError("영상 프롬프트가 비어 있습니다.")
            if len(prompt) > 10000:
                raise ValueError("영상 프롬프트는 10,000자 이하여야 합니다.")
            resolution = str(request_data.get("resolution") or "720p")
            if resolution not in {"480p", "720p", "1080p", "4k"}:
                raise ValueError("지원하지 않는 영상 해상도입니다.")
            if ("mini" in model_key or "2.0-fast" in model_key) and resolution not in {"480p", "720p"}:
                raise ValueError("선택한 Seedance 모델은 480p와 720p만 지원합니다.")
            if model_key in {"kling-v3-turbo-std", "kling-v2.6-std"} and resolution != "720p":
                raise ValueError("선택한 Kling Standard 모델은 720p로 생성됩니다.")
            if model_key in {"kling-v3-turbo-pro", "kling-v2.6-pro"} and resolution != "1080p":
                raise ValueError("선택한 Kling Pro 모델은 1080p로 생성됩니다.")
            duration = int(request_data.get("duration") or 5)
            maximum_duration = 30 if model_key.startswith("seedance-2.5") else 15
            minimum_duration = 5 if is_kling else 4
            if model_key.startswith("kling-v2.6") and duration not in {5, 10}:
                raise ValueError("Kling 2.6 모델의 영상 길이는 5초 또는 10초여야 합니다.")
            if duration < minimum_duration or duration > maximum_duration:
                raise ValueError(f"선택한 모델의 영상 길이는 {minimum_duration}~{maximum_duration}초여야 합니다.")
            images = request_data.get("images") or []
            if not isinstance(images, list) or not 1 <= len(images) <= 30:
                raise ValueError("영상 참조 이미지는 1~30장이어야 합니다.")

            def upload_image(image, index):
                data_url = str((image or {}).get("dataUrl") or "")
                match = re.fullmatch(r"data:(image/[A-Za-z0-9.+-]+);base64,(.+)", data_url, re.DOTALL)
                if not match:
                    raise ValueError(f"@image{index} 데이터가 올바르지 않습니다.")
                content_type, encoded = match.groups()
                try:
                    image_bytes = base64.b64decode(encoded, validate=True)
                except binascii.Error as error:
                    raise ValueError(f"@image{index} Base64 데이터가 손상되었습니다.") from error
                if not image_bytes or len(image_bytes) > 200 * 1024 * 1024:
                    raise ValueError(f"@image{index}는 200MB 이하여야 합니다.")
                filename = re.sub(
                    r"[^A-Za-z0-9._-]", "-",
                    str((image or {}).get("name") or f"reference-{index}.png")
                )
                _, ticket_body = self.wavespeed_request("/media/uploads", "POST", {
                    "filename": filename,
                    "size": len(image_bytes),
                    "content_type": content_type,
                })
                ticket = ticket_body.get("data", ticket_body)
                upload = ticket.get("upload") or {}
                if not upload.get("url") or not ticket.get("download_url"):
                    raise ValueError(f"@image{index} 업로드 주소를 받지 못했습니다.")
                upload_request = urllib.request.Request(
                    upload["url"],
                    data=image_bytes,
                    headers={str(key): str(value) for key, value in (upload.get("headers") or {}).items()},
                    method=str(upload.get("method") or "PUT"),
                )
                with safe_urlopen(upload_request, timeout=300) as upload_response:
                    if not 200 <= upload_response.status < 300:
                        raise ValueError(f"@image{index} 업로드에 실패했습니다.")
                return ticket["download_url"]

            images_to_upload = images[:1] if is_kling else images
            image_urls = [upload_image(image, index + 1) for index, image in enumerate(images_to_upload)]
            multi_reference = not is_kling and len(image_urls) > 1
            effective_model_id = WAVESPEED_MULTI_REFERENCE_MODELS[model_key] if multi_reference else model_id
            if is_kling:
                payload = {
                    "image": image_urls[0],
                    "prompt": prompt,
                    "duration": duration,
                    "enable_safety_checker": bool(request_data.get("enableSafetyChecker", True)),
                }
                if model_key == "kling-v2.6-pro":
                    payload["sound"] = bool(request_data.get("generateAudio", True))
            else:
                payload = {
                    "prompt": prompt,
                    "resolution": resolution,
                    "duration": duration,
                    "generate_audio": bool(request_data.get("generateAudio", True)),
                    "enable_safety_checker": bool(request_data.get("enableSafetyChecker", True)),
                }
            if multi_reference:
                aspect_ratio = str(request_data.get("aspectRatio") or "16:9")
                if aspect_ratio not in {"16:9", "9:16", "4:3", "3:4", "1:1", "21:9"}:
                    raise ValueError("지원하지 않는 영상 화면비입니다.")
                payload["reference_images"] = image_urls
                payload["aspect_ratio"] = aspect_ratio
            elif not is_kling:
                payload["image"] = image_urls[0]
            _, result = self.wavespeed_request(f"/{effective_model_id}", "POST", payload)
            task = result.get("data", result)
            if not task.get("id"):
                raise ValueError("WaveSpeedAI가 영상 작업 ID를 반환하지 않았습니다.")
            self.send_json(200, {
                "id": task.get("id"),
                "status": task.get("status"),
                "model": model_key,
                "mode": "multi-reference" if multi_reference else "first-frame",
                "effectiveModel": effective_model_id,
                "imageCount": len(image_urls),
            })
        except ValueError as error:
            status = 503 if "WAVESPEED_API_KEY" in str(error) else 400
            self.send_json(status, {"error": str(error)})
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            try:
                parsed = json.loads(detail)
                message = parsed.get("message") or parsed.get("error") or detail
            except json.JSONDecodeError:
                message = detail
            self.send_json(error.code, {"error": message or f"WaveSpeedAI 요청 실패 ({error.code})"})
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            self.send_json(502, {"error": f"WaveSpeedAI 연결 오류: {error}"})
        except Exception as error:
            print(f"WaveSpeedAI 영상 생성 처리 오류: {error}")
            self.send_json(500, {"error": f"WaveSpeedAI 영상 생성 처리 중 서버 오류가 발생했습니다: {error}"})

    def handle_wavespeed_prediction_status(self):
        query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        prediction_id = str((query.get("id") or [""])[0]).strip()
        if not prediction_id or not re.fullmatch(r"[A-Za-z0-9._-]+", prediction_id):
            self.send_json(400, {"error": "WaveSpeedAI 작업 ID가 올바르지 않습니다."})
            return
        try:
            status, result = self.wavespeed_request(f"/predictions/{urllib.parse.quote(prediction_id)}/result")
            self.send_json(status, result.get("data", result))
        except ValueError as error:
            self.send_json(503, {"error": str(error)})
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            self.send_json(error.code, {"error": detail or f"WaveSpeedAI 작업 조회 실패 ({error.code})"})
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            self.send_json(502, {"error": f"WaveSpeedAI 작업 조회 오류: {error}"})

    def handle_apiframe_music_generate(self, request_data):
        prompt = str(request_data.get("prompt") or "").strip()
        if not prompt:
            self.send_json(400, {"error": "Suno 프롬프트가 비어 있습니다."})
            return
        if len(prompt) > 500:
            self.send_json(400, {"error": "Suno 설명 프롬프트는 500자 이하여야 합니다."})
            return
        version = str(request_data.get("modelVersion") or "AUTO")
        if version not in {"AUTO", "V4", "V4_5", "V4_5ALL", "V4_5PLUS", "V5", "V5_5"}:
            self.send_json(400, {"error": "지원하지 않는 Suno 모델 버전입니다."})
            return
        payload = {"model": "suno", "prompt": prompt}
        if version != "AUTO":
            suno_params = {
                "custom_mode": False,
                "instrumental": bool(request_data.get("instrumental", True)),
                "model_version": version,
            }
            style = str(request_data.get("style") or "").strip()
            if style:
                suno_params["style"] = style[:1000]
            payload["sunoParams"] = suno_params
        try:
            status, result = self.apiframe_request(
                "/music/generate", "POST", payload,
            )
            self.send_json(status, result)
        except ValueError as error:
            self.send_json(503, {"error": str(error)})
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            self.send_json(error.code, {"error": detail or "APIFRAME 음악 생성 요청에 실패했습니다."})
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            self.send_json(502, {"error": f"APIFRAME 연결 오류: {error}"})

    def handle_apiframe_job_status(self):
        query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        job_id = str((query.get("id") or [""])[0]).strip()
        if not job_id or not all(character.isalnum() or character in "-_" for character in job_id):
            self.send_json(400, {"error": "작업 ID가 올바르지 않습니다."})
            return
        try:
            status, result = self.apiframe_request(f"/jobs/{urllib.parse.quote(job_id)}")
            self.send_json(status, result)
        except ValueError as error:
            self.send_json(503, {"error": str(error)})
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            self.send_json(error.code, {"error": detail or "APIFRAME 작업 조회에 실패했습니다."})
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            self.send_json(502, {"error": f"APIFRAME 연결 오류: {error}"})

    @staticmethod
    def current_app_version():
        try:
            return VERSION_FILE.read_text(encoding="utf-8").strip().lstrip("v") or "0.0.0"
        except OSError:
            return "0.0.0"

    @staticmethod
    def version_key(value):
        numbers = [int(part) for part in re.findall(r"\d+", str(value or ""))[:3]]
        return tuple((numbers + [0, 0, 0])[:3])

    @staticmethod
    def github_latest_release():
        repository = os.environ.get("GITHUB_UPDATE_REPOSITORY", "sydgam/AI_Video_Studio").strip()
        token = os.environ.get("GITHUB_UPDATE_TOKEN", "").strip()
        if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repository):
            raise ValueError("GITHUB_UPDATE_REPOSITORY 형식이 올바르지 않습니다.")
        headers = {
            "Accept": "application/vnd.github+json",
            "User-Agent": "AI-Video-Studio-Updater/1.0",
            "X-GitHub-Api-Version": "2026-03-10",
        }
        if token:
            headers["Authorization"] = f"Bearer {token}"
        request = urllib.request.Request(
            f"https://api.github.com/repos/{repository}/releases/latest", headers=headers
        )
        with safe_urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8")), token

    @staticmethod
    def release_zip_asset(release):
        assets = release.get("assets") if isinstance(release, dict) else []
        candidates = [asset for asset in (assets or []) if str(asset.get("name", "")).lower().endswith(".zip")]
        preferred = [asset for asset in candidates if str(asset.get("name", "")).lower().startswith("ai-video-studio")]
        return (preferred or candidates or [None])[0]

    def handle_update_check(self):
        current = self.current_app_version()
        try:
            release, _ = self.github_latest_release()
            latest = str(release.get("tag_name") or "0.0.0").lstrip("v")
            asset = self.release_zip_asset(release)
            self.send_json(200, {
                "currentVersion": current,
                "latestVersion": latest,
                "updateAvailable": self.version_key(latest) > self.version_key(current),
                "releaseName": release.get("name") or release.get("tag_name") or "",
                "notes": release.get("body") or "",
                "publishedAt": release.get("published_at"),
                "asset": ({"name": asset.get("name"), "size": asset.get("size"), "digest": asset.get("digest")} if asset else None),
            })
        except urllib.error.HTTPError as error:
            if error.code in (401, 403, 404) and not os.environ.get("GITHUB_UPDATE_TOKEN"):
                self.send_json(503, {"error": "비공개 GitHub Release 확인을 위해 .env에 GITHUB_UPDATE_TOKEN을 설정해 주세요.", "currentVersion": current})
            else:
                self.send_json(error.code, {"error": f"GitHub Release 확인 실패 ({error.code})", "currentVersion": current})
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError) as error:
            self.send_json(502, {"error": f"업데이트 확인 오류: {error}", "currentVersion": current})

    def handle_update_download(self):
        try:
            release, token = self.github_latest_release()
            asset = self.release_zip_asset(release)
            if not asset or not asset.get("url"):
                raise ValueError("최신 Release에서 업데이트 ZIP을 찾지 못했습니다.")
            headers = {
                "Accept": "application/octet-stream",
                "User-Agent": "AI-Video-Studio-Updater/1.0",
                "X-GitHub-Api-Version": "2026-03-10",
            }
            if token:
                headers["Authorization"] = f"Bearer {token}"
            request = urllib.request.Request(asset["url"], headers=headers)
            with safe_urlopen(request, timeout=120) as response:
                content = response.read(500 * 1024 * 1024 + 1)
            if len(content) > 500 * 1024 * 1024:
                raise ValueError("업데이트 파일이 500MB를 초과합니다.")
            digest = str(asset.get("digest") or "")
            actual_digest = "sha256:" + hashlib.sha256(content).hexdigest()
            if digest.startswith("sha256:") and digest.lower() != actual_digest.lower():
                raise ValueError("업데이트 파일 체크섬이 일치하지 않습니다.")
            UPDATES_ROOT.mkdir(parents=True, exist_ok=True)
            safe_name = re.sub(r"[^A-Za-z0-9._-]", "-", str(asset.get("name") or "update.zip"))
            target = UPDATES_ROOT / safe_name
            target.write_bytes(content)
            self.send_json(200, {
                "downloaded": True,
                "version": str(release.get("tag_name") or "").lstrip("v"),
                "name": safe_name,
                "size": len(content),
                "digest": actual_digest,
                "path": str(target),
            })
        except urllib.error.HTTPError as error:
            self.send_json(error.code, {"error": f"업데이트 다운로드 실패 ({error.code})"})
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError, OSError) as error:
            self.send_json(502, {"error": f"업데이트 다운로드 오류: {error}"})

    def do_GET(self):
        requested_path = urllib.parse.unquote(urllib.parse.urlparse(self.path).path)
        path_parts = Path(requested_path.replace("\\", "/")).parts
        if any(part.startswith(".") for part in path_parts) or requested_path.startswith("/projects/"):
            self.send_json(404, {"error": "접근할 수 없는 경로입니다."})
            return
        if self.path == "/api/health":
            self.send_json(200, {
                "apiVersion": 2,
                "ok": True,
                "openaiConfigured": bool(os.environ.get("OPENAI_API_KEY")),
                "anthropicConfigured": bool(os.environ.get("ANTHROPIC_API_KEY")),
                "geminiConfigured": bool(os.environ.get("GEMINI_API_KEY")),
                "seedreamConfigured": bool(os.environ.get("ARK_API_KEY")),
                "apiframeConfigured": bool(os.environ.get("APIFRAME_API_KEY")),
                "wavespeedConfigured": bool(os.environ.get("WAVESPEED_API_KEY")),
            })
            return
        if requested_path == "/api/bgm/audio":
            try:
                job_id = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get('id', [''])[0]
                audio = local_bgm_service.audio_file(job_id)
                with audio.open('rb') as stream:
                    self.send_response(200)
                    self.send_header('Content-Type', 'audio/wav')
                    self.send_header('Content-Length', str(audio.stat().st_size))
                    self.end_headers()
                    import shutil
                    shutil.copyfileobj(stream, self.wfile)
            except (OSError, ValueError, KeyError):
                self.send_json(404, {'error': '음악 파일을 찾을 수 없습니다.'})
            return
        if requested_path == "/api/bgm/status":
            self.send_json(200, local_bgm_service.status())
            return
        if requested_path == "/api/tts/status":
            engine_url = os.environ.get("LOCAL_TTS_URL", "http://127.0.0.1:8060").rstrip("/")
            try:
                with urllib.request.urlopen(f"{engine_url}/health", timeout=1.5) as response:
                    payload = json.loads(response.read().decode("utf-8"))
                self.send_json(200, {
                    "ready": bool(payload.get("ready", payload.get("ok", False))),
                    "engine": payload.get("engine", "Qwen3-TTS"),
                    "modelLoaded": bool(payload.get("modelLoaded", False)),
                    "availableModels": payload.get("availableModels", []),
                    "capabilities": payload.get("capabilities", {}),
                    "busy": payload.get("busy", False),
                    "stage": payload.get("stage", "idle"),
                    "elapsedSeconds": payload.get("elapsedSeconds", 0),
                    "lastResult": payload.get("lastResult", {}),
                })
            except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
                self.send_json(200, {
                    "ready": False,
                    "engine": "Qwen3-TTS",
                    "modelLoaded": False,
                })
            return
        if requested_path == "/api/updates/check":
            self.handle_update_check()
            return
        if requested_path == "/api/google/status":
            self.send_json(200, {
                "configured": bool(os.environ.get("GOOGLE_CLIENT_ID") and os.environ.get("GOOGLE_CLIENT_SECRET")),
                "connected": bool(os.environ.get("GOOGLE_REFRESH_TOKEN")),
            })
            return
        if requested_path == "/api/google/oauth/start":
            self.handle_google_oauth_start()
            return
        if requested_path == "/api/google/oauth/callback":
            self.handle_google_oauth_callback()
            return
        if requested_path == "/api/apiframe/jobs":
            self.handle_apiframe_job_status()
            return
        if requested_path == "/api/wavespeed/predictions":
            self.handle_wavespeed_prediction_status()
            return
        if requested_path == "/api/google/videos/operations":
            self.handle_google_video_operation()
            return
        if requested_path == "/api/generated-video":
            self.handle_generated_video()
            return
        if self.path.startswith("/api/project-files/download?"):
            self.handle_project_file_download()
            return
        super().do_GET()

    def do_POST(self):
        if self.path not in {
            "/api/openai/responses",
            "/api/anthropic/messages",
            "/api/gemini/generate",
            "/api/apiframe/music/generate",
            "/api/images/generations",
            "/api/wavespeed/videos/generations",
            "/api/google/videos/generations",
            "/api/project-files/sync",
            "/api/project-files/list",
            "/api/project-files/delete",
            "/api/google/docs/read",
            "/api/documents/extract",
            "/api/updates/download",
            "/api/tts/generate",
            "/api/bgm/generate",
            "/api/bgm/editor/start",
            "/api/bgm/editor/stop",
        }:
            self.send_json(404, {"error": "API 경로를 찾을 수 없습니다."})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_json(400, {"error": "요청 크기가 올바르지 않습니다."})
            return

        if content_length <= 0 or content_length > MAX_BODY_SIZE:
            self.send_json(413, {"error": "참조 이미지를 포함한 요청은 200MB 이하여야 합니다."})
            return

        try:
            request_data = json.loads(self.rfile.read(content_length).decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self.send_json(400, {"error": "요청 JSON 형식이 올바르지 않습니다."})
            return

        if self.path in ("/api/bgm/editor/start", "/api/bgm/editor/stop"):
            try:
                with local_bgm_service.LOCK:
                    if local_bgm_service.active:
                        self.send_json(409, {"error": "현재 음악 생성이 끝난 후 전환해 주세요."})
                        return
                    editor = local_bgm_service.bgm_full_editor
                    self.send_json(200, editor.start() if self.path.endswith('/start') else editor.stop())
            except (OSError, RuntimeError) as error:
                self.send_json(503, {"error": str(error)})
            return
        if self.path == "/api/bgm/generate":
            try:
                self.send_json(202, local_bgm_service.generate(request_data))
            except (ValueError, TypeError, OverflowError) as error:
                self.send_json(400, {"error": str(error)})
            except FileNotFoundError as error:
                self.send_json(503, {"error": str(error)})
            except RuntimeError as error:
                self.send_json(409, {"error": str(error)})
            return
        if self.path == "/api/project-files/sync":
            self.handle_project_files_sync(request_data)
            return
        if self.path == "/api/project-files/list":
            self.handle_project_files_list(request_data)
            return
        if self.path == "/api/project-files/delete":
            self.handle_project_file_delete(request_data)
            return
        if self.path == "/api/images/generations":
            self.handle_image_generation(request_data)
            return
        if self.path == "/api/wavespeed/videos/generations":
            self.handle_wavespeed_video_generate(request_data)
            return
        if self.path == "/api/google/videos/generations":
            self.handle_google_video_generate(request_data)
            return
        if self.path == "/api/google/docs/read":
            self.handle_google_docs_read(request_data)
            return
        if self.path == "/api/documents/extract":
            self.handle_document_extract(request_data)
            return
        if self.path == "/api/updates/download":
            self.handle_update_download()
            return
        if self.path == "/api/tts/generate":
            engine_url = os.environ.get("LOCAL_TTS_URL", "http://127.0.0.1:8060").rstrip("/")
            try:
                payload = json.dumps(request_data, ensure_ascii=False).encode("utf-8")
                request = urllib.request.Request(
                    f"{engine_url}/generate",
                    data=payload,
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with urllib.request.urlopen(request, timeout=900) as response:
                    result = json.loads(response.read().decode("utf-8"))
                self.send_json(200, result)
            except urllib.error.HTTPError as error:
                try:
                    detail = json.loads(error.read().decode("utf-8")).get("detail")
                except (json.JSONDecodeError, UnicodeDecodeError):
                    detail = None
                self.send_json(error.code, {"error": detail or f"TTS 엔진 오류 ({error.code})"})
            except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as error:
                self.send_json(503, {"error": f"로컬 TTS 엔진에 연결하지 못했습니다: {error}"})
            return
        if self.path == "/api/anthropic/messages":
            self.handle_anthropic_message(request_data)
            return
        if self.path == "/api/gemini/generate":
            self.handle_gemini_text(request_data)
            return
        if self.path == "/api/apiframe/music/generate":
            self.handle_apiframe_music_generate(request_data)
            return

        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            self.send_json(503, {"error": "서버에 OPENAI_API_KEY가 설정되지 않았습니다."})
            return

        try:
            model = request_data.get("model", "gpt-5.6-sol")
            effort = request_data.get("reasoningEffort", "medium")
            verbosity = request_data.get("verbosity", "medium")
            prompt_input = request_data.get("input", "")
            instructions = request_data.get("instructions", "")
            style_images = request_data.get("styleImages", [])
            documents = request_data.get("documents", [])
            web_search = request_data.get("webSearch", False)

            if model not in ALLOWED_MODELS:
                raise ValueError("지원하지 않는 OpenAI 모델입니다.")
            if effort not in ALLOWED_EFFORTS:
                raise ValueError("지원하지 않는 추론 강도입니다.")
            if verbosity not in ALLOWED_VERBOSITY:
                raise ValueError("지원하지 않는 응답 길이입니다.")
            if not isinstance(prompt_input, str) or not prompt_input.strip():
                raise ValueError("GPT 노드 입력이 비어 있습니다.")
            if not isinstance(instructions, str):
                raise ValueError("시스템 지침 형식이 올바르지 않습니다.")
            if not isinstance(style_images, list) or len(style_images) > 6:
                raise ValueError("글로벌 스타일 이미지는 최대 6장까지 전달할 수 있습니다.")
            if any(
                not isinstance(image, str) or not image.startswith("data:image/")
                for image in style_images
            ):
                raise ValueError("글로벌 스타일 이미지 형식이 올바르지 않습니다.")
            if not isinstance(documents, list) or len(documents) > 10:
                raise ValueError("문서는 한 번에 최대 10개까지 전달할 수 있습니다.")
            if not isinstance(web_search, bool):
                raise ValueError("웹 검색 설정 형식이 올바르지 않습니다.")
            total_document_bytes = 0
            for document in documents:
                if not isinstance(document, dict):
                    raise ValueError("문서 입력 형식이 올바르지 않습니다.")
                data_url = document.get("dataUrl", "")
                text_value = document.get("text", "")
                if data_url:
                    if not isinstance(data_url, str) or ";base64," not in data_url:
                        raise ValueError("문서 파일 데이터 형식이 올바르지 않습니다.")
                    total_document_bytes += len(data_url) * 3 // 4
                elif not isinstance(text_value, str):
                    raise ValueError("문서 텍스트 형식이 올바르지 않습니다.")
            if total_document_bytes > 50 * 1024 * 1024:
                raise ValueError("한 요청에 전달하는 문서 파일의 합계는 50MB 이하여야 합니다.")
        except (ValueError, binascii.Error) as error:
            self.send_json(400, {"error": str(error)})
            return

        openai_input = prompt_input
        if style_images or documents:
            content = [{"type": "input_text", "text": prompt_input}]
            for document in documents:
                source = document.get("source", "")
                data_url = document.get("dataUrl", "")
                if source == "ocr-image" and data_url:
                    content.append({"type": "input_image", "image_url": data_url, "detail": "high"})
                elif data_url:
                    content.append({
                        "type": "input_file",
                        "filename": str(document.get("name") or "document"),
                        "file_data": data_url,
                    })
                elif document.get("text"):
                    title = str(document.get("name") or "Google Docs")
                    content.append({
                        "type": "input_text",
                        "text": f"\n[문서: {title}]\n{document['text']}",
                    })
            openai_input = [{
                "role": "user",
                "content": [
                    *content,
                    *[
                        {"type": "input_image", "image_url": image, "detail": "high"}
                        for image in style_images
                    ],
                ],
            }]

        openai_payload = {
            "model": model,
            "input": openai_input,
            "reasoning": {"effort": effort},
            "text": {"verbosity": verbosity},
        }
        if instructions.strip():
            openai_payload["instructions"] = instructions
        if web_search:
            openai_payload["tools"] = [{"type": "web_search"}]
            openai_payload["tool_choice"] = "auto"
            openai_payload["include"] = ["web_search_call.action.sources"]

        upstream_request = urllib.request.Request(
            OPENAI_RESPONSES_URL,
            data=json.dumps(openai_payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            with safe_urlopen(upstream_request, timeout=180) as response:
                response_data = json.loads(response.read().decode("utf-8"))
            output_text = "".join(
                content.get("text", "")
                for item in response_data.get("output", [])
                if item.get("type") == "message"
                for content in item.get("content", [])
                if content.get("type") == "output_text"
            )
            sources = collect_web_sources(response_data.get("output", []))
            search_queries = [
                query
                for item in response_data.get("output", [])
                if item.get("type") == "web_search_call"
                for query in ([item.get("action", {}).get("query")] if item.get("action", {}).get("query") else item.get("action", {}).get("queries", []))
                if isinstance(query, str)
            ]
            self.send_json(200, {
                "id": response_data.get("id"),
                "model": response_data.get("model", model),
                "outputText": output_text,
                "usage": response_data.get("usage"),
                "searched": any(item.get("type") == "web_search_call" for item in response_data.get("output", [])),
                "sources": sources,
                "searchQueries": search_queries,
            })
        except urllib.error.HTTPError as error:
            try:
                error_data = json.loads(error.read().decode("utf-8"))
                message = error_data.get("error", {}).get("message", "OpenAI API 요청이 실패했습니다.")
            except (json.JSONDecodeError, UnicodeDecodeError):
                message = "OpenAI API 요청이 실패했습니다."
            self.send_json(error.code, {"error": message})
        except (urllib.error.URLError, TimeoutError) as error:
            reason = getattr(error, "reason", error)
            print(f"OpenAI API 연결 오류: {reason}")
            self.send_json(502, {"error": f"OpenAI API 서버에 연결하지 못했습니다. ({reason})"})

    @staticmethod
    def decode_data_url(data_url):
        if not isinstance(data_url, str) or ";base64," not in data_url:
            raise ValueError("파일 데이터 형식이 올바르지 않습니다.")
        header, encoded = data_url.split(",", 1)
        mime_type = header.split(":", 1)[1].split(";", 1)[0]
        base64.b64decode(encoded, validate=True)
        return mime_type, encoded

    @staticmethod
    def validate_text_llm_request(request_data, allowed_models, default_model):
        model = request_data.get("model", default_model)
        prompt_input = request_data.get("input", "")
        instructions = request_data.get("instructions", "")
        style_images = request_data.get("styleImages", [])
        documents = request_data.get("documents", [])
        web_search = request_data.get("webSearch", False)
        if model not in allowed_models:
            raise ValueError("지원하지 않는 텍스트 AI 모델입니다.")
        if not isinstance(prompt_input, str) or not prompt_input.strip():
            raise ValueError("텍스트 AI 노드 입력이 비어 있습니다.")
        if not isinstance(instructions, str):
            raise ValueError("시스템 지침 형식이 올바르지 않습니다.")
        if not isinstance(style_images, list) or len(style_images) > 6:
            raise ValueError("글로벌 스타일 이미지는 최대 6장까지 전달할 수 있습니다.")
        if not isinstance(documents, list) or len(documents) > 10:
            raise ValueError("문서는 한 번에 최대 10개까지 전달할 수 있습니다.")
        if not isinstance(web_search, bool):
            raise ValueError("웹 검색 설정 형식이 올바르지 않습니다.")
        return model, prompt_input, instructions, style_images, documents, web_search

    def handle_anthropic_message(self, request_data):
        api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
        if not api_key:
            self.send_json(503, {"error": "서버에 ANTHROPIC_API_KEY가 설정되지 않았습니다."})
            return
        try:
            model, prompt_input, instructions, style_images, documents, web_search = self.validate_text_llm_request(
                request_data, ANTHROPIC_MODELS, "claude-sonnet-5"
            )
            content = [{"type": "text", "text": prompt_input}]
            for data_url in style_images:
                mime_type, encoded = self.decode_data_url(data_url)
                if not mime_type.startswith("image/"):
                    raise ValueError("Claude 스타일 입력은 이미지 형식이어야 합니다.")
                content.append({
                    "type": "image",
                    "source": {"type": "base64", "media_type": mime_type, "data": encoded},
                })
            for document in documents:
                data_url = document.get("dataUrl", "") if isinstance(document, dict) else ""
                text_value = document.get("text", "") if isinstance(document, dict) else ""
                if text_value:
                    title = str(document.get("name") or "문서")
                    content.append({"type": "text", "text": f"\n[문서: {title}]\n{text_value}"})
                elif data_url:
                    mime_type, encoded = self.decode_data_url(data_url)
                    if mime_type.startswith("image/"):
                        content.append({
                            "type": "image",
                            "source": {"type": "base64", "media_type": mime_type, "data": encoded},
                        })
                    elif mime_type == "application/pdf":
                        content.append({
                            "type": "document",
                            "source": {"type": "base64", "media_type": mime_type, "data": encoded},
                        })
                    else:
                        raise ValueError("Claude 문서 입력은 PDF, 이미지 또는 텍스트만 지원합니다.")
            payload = {
                "model": model,
                "max_tokens": 16000,
                "messages": [{"role": "user", "content": content}],
            }
            if instructions.strip():
                payload["system"] = instructions
            if web_search:
                payload["tools"] = [{
                    "type": "web_search_20250305",
                    "name": "web_search",
                    "max_uses": 3,
                    "user_location": {
                        "type": "approximate",
                        "country": "KR",
                        "timezone": "Asia/Seoul",
                    },
                }]
            upstream_request = urllib.request.Request(
                ANTHROPIC_MESSAGES_URL,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            with safe_urlopen(upstream_request, timeout=180) as response:
                response_data = json.loads(response.read().decode("utf-8"))
            output_text = "".join(
                block.get("text", "")
                for block in response_data.get("content", [])
                if block.get("type") == "text"
            )
            sources = collect_web_sources(response_data.get("content", []))
            self.send_json(200, {
                "id": response_data.get("id"),
                "model": response_data.get("model", model),
                "outputText": output_text,
                "usage": response_data.get("usage"),
                "searched": any(block.get("type") in {"server_tool_use", "web_search_tool_result"} for block in response_data.get("content", [])),
                "sources": sources,
                "searchQueries": [],
            })
        except (ValueError, binascii.Error) as error:
            self.send_json(400, {"error": str(error)})
        except urllib.error.HTTPError as error:
            try:
                error_data = json.loads(error.read().decode("utf-8"))
                message = error_data.get("error", {}).get("message", "Claude API 요청이 실패했습니다.")
            except (json.JSONDecodeError, UnicodeDecodeError):
                message = "Claude API 요청이 실패했습니다."
            self.send_json(error.code, {"error": message})
        except (urllib.error.URLError, TimeoutError) as error:
            reason = getattr(error, "reason", error)
            print(f"Claude API 연결 오류: {reason}")
            self.send_json(502, {"error": f"Claude API 서버에 연결하지 못했습니다. ({reason})"})

    def handle_gemini_text(self, request_data):
        api_key = os.environ.get("GEMINI_API_KEY", "").strip()
        if not api_key:
            self.send_json(503, {"error": "서버에 GEMINI_API_KEY가 설정되지 않았습니다."})
            return
        try:
            model, prompt_input, instructions, style_images, documents, web_search = self.validate_text_llm_request(
                request_data, GEMINI_TEXT_MODELS, "gemini-3.8-flash"
            )
            parts = [{"text": prompt_input}]
            for data_url in style_images:
                mime_type, encoded = self.decode_data_url(data_url)
                parts.append({"inline_data": {"mime_type": mime_type, "data": encoded}})
            for document in documents:
                data_url = document.get("dataUrl", "") if isinstance(document, dict) else ""
                text_value = document.get("text", "") if isinstance(document, dict) else ""
                if text_value:
                    title = str(document.get("name") or "문서")
                    parts.append({"text": f"\n[문서: {title}]\n{text_value}"})
                elif data_url:
                    mime_type, encoded = self.decode_data_url(data_url)
                    parts.append({"inline_data": {"mime_type": mime_type, "data": encoded}})
            payload = {"contents": [{"role": "user", "parts": parts}]}
            if instructions.strip():
                payload["system_instruction"] = {"parts": [{"text": instructions}]}
            if web_search:
                payload["tools"] = [{"google_search": {}}]
            upstream_request = urllib.request.Request(
                GEMINI_GENERATE_URL.format(model=urllib.parse.quote(model, safe="")),
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "x-goog-api-key": api_key,
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            with safe_urlopen(upstream_request, timeout=180) as response:
                response_data = json.loads(response.read().decode("utf-8"))
            output_text = "".join(
                part.get("text", "")
                for candidate in response_data.get("candidates", [])
                for part in candidate.get("content", {}).get("parts", [])
                if isinstance(part.get("text"), str)
            )
            sources = collect_web_sources([
                candidate.get("groundingMetadata") or candidate.get("grounding_metadata") or {}
                for candidate in response_data.get("candidates", [])
            ])
            search_queries = [
                query
                for candidate in response_data.get("candidates", [])
                for query in (candidate.get("groundingMetadata", {}).get("webSearchQueries", []) or candidate.get("grounding_metadata", {}).get("web_search_queries", []))
                if isinstance(query, str)
            ]
            self.send_json(200, {
                "id": response_data.get("responseId"),
                "model": response_data.get("modelVersion", model),
                "outputText": output_text,
                "usage": response_data.get("usageMetadata"),
                "searched": bool(sources or search_queries),
                "sources": sources,
                "searchQueries": search_queries,
            })
        except (ValueError, binascii.Error) as error:
            self.send_json(400, {"error": str(error)})
        except urllib.error.HTTPError as error:
            try:
                error_data = json.loads(error.read().decode("utf-8"))
                message = error_data.get("error", {}).get("message", "Gemini API 요청이 실패했습니다.")
            except (json.JSONDecodeError, UnicodeDecodeError):
                message = "Gemini API 요청이 실패했습니다."
            self.send_json(error.code, {"error": message})
        except (urllib.error.URLError, TimeoutError) as error:
            reason = getattr(error, "reason", error)
            print(f"Gemini API 연결 오류: {reason}")
            self.send_json(502, {"error": f"Gemini API 서버에 연결하지 못했습니다. ({reason})"})

    def handle_google_oauth_start(self):
        client_id = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
        client_secret = os.environ.get("GOOGLE_CLIENT_SECRET", "").strip()
        if not client_id or not client_secret:
            self.send_json(503, {"error": ".env에 GOOGLE_CLIENT_ID와 GOOGLE_CLIENT_SECRET을 먼저 설정해 주세요."})
            return
        state = secrets.token_urlsafe(24)
        GOOGLE_OAUTH_STATES.add(state)
        query = urllib.parse.urlencode({
            "client_id": client_id,
            "redirect_uri": f"http://localhost:{PORT}/api/google/oauth/callback",
            "response_type": "code",
            "scope": GOOGLE_DOCS_SCOPE,
            "access_type": "offline",
            "prompt": "consent",
            "state": state,
        })
        self.send_response(302)
        self.send_header("Location", f"{GOOGLE_AUTH_URL}?{query}")
        self.end_headers()

    def handle_google_oauth_callback(self):
        query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        state = query.get("state", [""])[0]
        code = query.get("code", [""])[0]
        error_message = query.get("error", [""])[0]
        if error_message or not code or state not in GOOGLE_OAUTH_STATES:
            self.send_google_oauth_page(False, error_message or "인증 요청을 확인할 수 없습니다.")
            return
        GOOGLE_OAUTH_STATES.discard(state)
        payload = urllib.parse.urlencode({
            "client_id": os.environ.get("GOOGLE_CLIENT_ID", ""),
            "client_secret": os.environ.get("GOOGLE_CLIENT_SECRET", ""),
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": f"http://localhost:{PORT}/api/google/oauth/callback",
        }).encode("utf-8")
        request = urllib.request.Request(
            GOOGLE_TOKEN_URL, data=payload,
            headers={"Content-Type": "application/x-www-form-urlencoded"}, method="POST"
        )
        try:
            with safe_urlopen(request, timeout=30) as response:
                token_data = json.loads(response.read().decode("utf-8"))
            refresh_token = token_data.get("refresh_token")
            if not refresh_token:
                raise ValueError("Google이 갱신 토큰을 반환하지 않았습니다.")
            os.environ["GOOGLE_REFRESH_TOKEN"] = refresh_token
            save_env_file()
            self.send_google_oauth_page(True, "Google Docs 읽기 전용 연결이 완료되었습니다.")
        except (urllib.error.URLError, urllib.error.HTTPError, ValueError, OSError) as error:
            self.send_google_oauth_page(False, f"Google 계정 연결 실패: {error}")

    def send_google_oauth_page(self, success, message):
        safe_message = str(message).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        color = "#38b27a" if success else "#d9534f"
        html = f"""<!doctype html><html lang="ko"><meta charset="utf-8">
<title>Google Docs 연결</title><body style="font-family:sans-serif;background:#f4f7f5;padding:48px;color:#24332b">
<h2 style="color:{color}">{safe_message}</h2>
<p>이 창을 닫고 AI Video Studio에서 Google Docs 노드를 실행하세요.</p>
<button onclick="window.close()">창 닫기</button></body></html>""".encode("utf-8")
        self.send_response(200 if success else 400)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(html)))
        self.end_headers()
        self.wfile.write(html)

    @staticmethod
    def google_access_token():
        refresh_token = os.environ.get("GOOGLE_REFRESH_TOKEN", "").strip()
        if not refresh_token:
            raise ValueError("Google 계정이 연결되지 않았습니다.")
        payload = urllib.parse.urlencode({
            "client_id": os.environ.get("GOOGLE_CLIENT_ID", ""),
            "client_secret": os.environ.get("GOOGLE_CLIENT_SECRET", ""),
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }).encode("utf-8")
        request = urllib.request.Request(
            GOOGLE_TOKEN_URL, data=payload,
            headers={"Content-Type": "application/x-www-form-urlencoded"}, method="POST"
        )
        with safe_urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))["access_token"]

    @staticmethod
    def google_document_text(document):
        pieces = []

        def visit(value):
            if isinstance(value, dict):
                text_run = value.get("textRun")
                if isinstance(text_run, dict) and isinstance(text_run.get("content"), str):
                    pieces.append(text_run["content"])
                for key, child in value.items():
                    if key != "textRun":
                        visit(child)
            elif isinstance(value, list):
                for child in value:
                    visit(child)

        visit(document.get("tabs") or document.get("body") or {})
        return "".join(pieces).strip()

    def handle_document_extract(self, request_data):
        name = str(request_data.get("name") or "document").strip()
        data_url = request_data.get("dataUrl", "")
        extension = Path(name).suffix.lower()
        supported = {".pptx", ".docx", ".odt", ".rtf", ".txt", ".md", ".json", ".html", ".xml"}
        if extension not in supported:
            self.send_json(400, {"error": "지원하지 않는 문서 형식입니다. PDF는 원본 파일로 직접 전달됩니다."})
            return
        try:
            mime_type, encoded = self.decode_data_url(data_url)
            raw = base64.b64decode(encoded, validate=True)
            if len(raw) > 50 * 1024 * 1024:
                raise ValueError("문서 파일은 50MB 이하여야 합니다.")

            text = ""
            item_count = None
            if extension == ".pptx":
                with zipfile.ZipFile(io.BytesIO(raw)) as archive:
                    slide_names = [
                        item.filename for item in archive.infolist()
                        if re.fullmatch(r"ppt/slides/slide\d+\.xml", item.filename)
                    ]
                    if sum(archive.getinfo(item).file_size for item in slide_names) > 100 * 1024 * 1024:
                        raise ValueError("PowerPoint 내부 문서 크기가 너무 큽니다.")
                    slide_names.sort(key=lambda item: int(re.search(r"slide(\d+)\.xml$", item).group(1)))
                    slides = []
                    namespace = {"a": "http://schemas.openxmlformats.org/drawingml/2006/main"}
                    for index, slide_name in enumerate(slide_names, 1):
                        root = ET.fromstring(archive.read(slide_name))
                        text_items = [
                            (node.text or "").strip() for node in root.findall(".//a:t", namespace)
                            if (node.text or "").strip()
                        ]
                        slides.append(f"[슬라이드 {index}]\n" + "\n".join(text_items))
                text = "\n\n".join(slides).strip()
                item_count = len(slides)
            elif extension == ".docx":
                with zipfile.ZipFile(io.BytesIO(raw)) as archive:
                    root = ET.fromstring(archive.read("word/document.xml"))
                    namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
                    paragraphs = []
                    for paragraph in root.findall(".//w:p", namespace):
                        value = "".join(node.text or "" for node in paragraph.findall(".//w:t", namespace)).strip()
                        if value:
                            paragraphs.append(value)
                text = "\n".join(paragraphs)
                item_count = len(paragraphs)
            elif extension == ".odt":
                with zipfile.ZipFile(io.BytesIO(raw)) as archive:
                    root = ET.fromstring(archive.read("content.xml"))
                    paragraphs = []
                    for node in root.iter():
                        if node.tag.endswith("}p") or node.tag.endswith("}h"):
                            value = "".join(node.itertext()).strip()
                            if value:
                                paragraphs.append(value)
                text = "\n".join(paragraphs)
                item_count = len(paragraphs)
            else:
                try:
                    text = raw.decode("utf-8-sig")
                except UnicodeDecodeError:
                    text = raw.decode("cp949", errors="replace")
                if extension in {".html", ".xml"}:
                    text = re.sub(r"<[^>]+>", " ", text)
                elif extension == ".rtf":
                    text = re.sub(r"\\'[0-9a-fA-F]{2}|\\[a-zA-Z]+-?\d* ?|[{}]", " ", text)
                text = re.sub(r"[ \t]+", " ", text)
                text = re.sub(r"\n{3,}", "\n\n", text).strip()

            if not text:
                raise ValueError("문서에서 읽을 수 있는 텍스트를 찾지 못했습니다.")
            if len(text) > 2_000_000:
                raise ValueError("추출된 문서 텍스트가 너무 큽니다.")
            payload = {"name": name, "mimeType": mime_type, "text": text}
            if extension == ".pptx":
                payload["slideCount"] = item_count
            elif item_count is not None:
                payload["paragraphCount"] = item_count
            self.send_json(200, payload)
        except (ValueError, binascii.Error, zipfile.BadZipFile, ET.ParseError) as error:
            self.send_json(400, {"error": str(error)})

    def handle_google_docs_read(self, request_data):
        document_url = str(request_data.get("documentUrl") or "").strip()
        match = re.search(r"/document/d/([a-zA-Z0-9_-]+)", document_url)
        if not match and re.fullmatch(r"[a-zA-Z0-9_-]{20,}", document_url):
            document_id = document_url
        elif match:
            document_id = match.group(1)
        else:
            self.send_json(400, {"error": "올바른 Google Docs 주소를 입력해 주세요."})
            return
        try:
            access_token = self.google_access_token()
            api_url = (
                f"https://docs.googleapis.com/v1/documents/{urllib.parse.quote(document_id)}"
                "?includeTabsContent=true"
            )
            request = urllib.request.Request(api_url, headers={"Authorization": f"Bearer {access_token}"})
            with safe_urlopen(request, timeout=60) as response:
                document = json.loads(response.read().decode("utf-8"))
            text = self.google_document_text(document)
            if not text:
                raise ValueError("문서에서 읽을 수 있는 텍스트를 찾지 못했습니다.")
            self.send_json(200, {
                "documentId": document_id,
                "title": document.get("title") or "Google Docs",
                "revisionId": document.get("revisionId"),
                "text": text,
            })
        except urllib.error.HTTPError as error:
            try:
                payload = json.loads(error.read().decode("utf-8"))
                message = payload.get("error", {}).get("message", "Google Docs API 요청에 실패했습니다.")
            except (json.JSONDecodeError, UnicodeDecodeError):
                message = "Google Docs API 요청에 실패했습니다."
            self.send_json(error.code, {"error": message})
        except (urllib.error.URLError, KeyError, ValueError) as error:
            self.send_json(502, {"error": str(error)})

    @staticmethod
    def project_file_listing(project_name):
        root = project_directory(project_name)
        for folder in PROJECT_FILE_ROOTS:
            (root / folder).mkdir(parents=True, exist_ok=True)
        files = []
        for path in root.rglob("*"):
            if not path.is_file() or path.name.startswith("."):
                continue
            stat = path.stat()
            files.append({
                "path": path.relative_to(root).as_posix(),
                "name": path.name,
                "size": stat.st_size,
                "modifiedAt": int(stat.st_mtime * 1000),
            })
        return root, sorted(files, key=lambda item: item["path"].lower())

    def handle_project_files_sync(self, request_data):
        try:
            project_name = request_data.get("projectName")
            files = request_data.get("files", [])
            if not isinstance(project_name, str) or not project_name.strip():
                raise ValueError("프로젝트 이름이 필요합니다.")
            if not isinstance(files, list) or len(files) > 300:
                raise ValueError("한 번에 저장할 수 있는 파일은 최대 300개입니다.")
            root = project_directory(project_name)
            for folder in PROJECT_FILE_ROOTS:
                (root / folder).mkdir(parents=True, exist_ok=True)
            for item in files:
                if not isinstance(item, dict):
                    raise ValueError("프로젝트 파일 정보가 올바르지 않습니다.")
                _, target = safe_project_file(project_name, item.get("path"))
                encoding = item.get("encoding", "utf8")
                content = item.get("content", "")
                if not isinstance(content, str):
                    raise ValueError("프로젝트 파일 내용이 올바르지 않습니다.")
                if encoding == "base64":
                    data = base64.b64decode(content, validate=True)
                elif encoding == "utf8":
                    data = content.encode("utf-8")
                else:
                    raise ValueError("지원하지 않는 파일 인코딩입니다.")
                target.parent.mkdir(parents=True, exist_ok=True)
                temporary = target.with_name(f".{target.name}.tmp")
                temporary.write_bytes(data)
                temporary.replace(target)
            root, listing = self.project_file_listing(project_name)
            self.send_json(200, {
                "ok": True,
                "projectPath": str(root),
                "files": listing,
            })
        except (ValueError, OSError, binascii.Error) as error:
            self.send_json(400, {"error": str(error)})

    def handle_project_files_list(self, request_data):
        try:
            project_name = request_data.get("projectName")
            if not isinstance(project_name, str) or not project_name.strip():
                raise ValueError("프로젝트 이름이 필요합니다.")
            root, listing = self.project_file_listing(project_name)
            self.send_json(200, {
                "ok": True,
                "projectPath": str(root),
                "files": listing,
            })
        except (ValueError, OSError) as error:
            self.send_json(400, {"error": str(error)})

    def handle_project_file_delete(self, request_data):
        try:
            project_name = request_data.get("projectName")
            relative_path = request_data.get("path")
            _, target = safe_project_file(project_name, relative_path)
            if not target.is_file():
                raise ValueError("삭제할 파일을 찾을 수 없습니다.")
            target.unlink()
            root, listing = self.project_file_listing(project_name)
            self.send_json(200, {
                "ok": True,
                "deleted": str(relative_path).replace("\\", "/"),
                "projectPath": str(root),
                "files": listing,
            })
        except (ValueError, OSError) as error:
            self.send_json(400, {"error": str(error)})

    def handle_project_file_download(self):
        try:
            query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            project_name = (query.get("projectName") or [""])[0]
            relative_path = (query.get("path") or [""])[0]
            _, target = safe_project_file(project_name, relative_path)
            if not target.is_file():
                raise ValueError("다운로드할 파일을 찾을 수 없습니다.")
            data = target.read_bytes()
            content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
            encoded_name = urllib.parse.quote(target.name)
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Content-Disposition", f"attachment; filename*=UTF-8''{encoded_name}")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)
        except (ValueError, OSError) as error:
            self.send_json(404, {"error": str(error)})

    def handle_image_generation(self, request_data):
        try:
            model = request_data.get("model", "gpt-image-2")
            prompt = request_data.get("prompt", "")
            aspect_ratio = request_data.get("aspectRatio", "1:1")
            resolution = request_data.get("resolution", "1K")
            if model == "nano-banana-2" and resolution == "512":
                resolution = "0.5K"
            output_format = request_data.get("outputFormat", "png")
            reference_images = request_data.get("referenceImages", [])

            model_config = IMAGE_MODELS.get(model)
            if not model_config:
                raise ValueError("지원하지 않는 이미지 모델입니다.")
            if not isinstance(prompt, str) or not prompt.strip():
                raise ValueError("이미지 생성 프롬프트가 비어 있습니다.")
            if len(prompt) > 32000:
                raise ValueError("이미지 생성 프롬프트는 32,000자 이하여야 합니다.")
            if aspect_ratio not in ALLOWED_ASPECT_RATIOS:
                raise ValueError("지원하지 않는 이미지 비율입니다.")
            if resolution not in model_config["resolutions"]:
                raise ValueError("선택한 모델이 지원하지 않는 해상도입니다.")
            if output_format not in ALLOWED_IMAGE_FORMATS:
                raise ValueError("지원하지 않는 이미지 형식입니다.")
            if output_format not in model_config["formats"]:
                supported_formats = ", ".join(sorted(model_config["formats"]))
                raise ValueError(
                    f"선택한 모델이 지원하지 않는 이미지 형식입니다. 지원 형식: {supported_formats}"
                )
            if not isinstance(reference_images, list):
                raise ValueError("참조 이미지 형식이 올바르지 않습니다.")
            if len(reference_images) > model_config["max_references"]:
                raise ValueError(
                    f"선택한 모델은 참조 이미지를 최대 {model_config['max_references']}장까지 지원합니다."
                )
            for reference in reference_images:
                if not isinstance(reference, dict) or not str(reference.get("dataUrl", "")).startswith("data:image/"):
                    raise ValueError("참조 이미지 데이터 형식이 올바르지 않습니다.")
        except ValueError as error:
            self.send_json(400, {"error": str(error)})
            return

        provider = model_config["provider"]
        api_model = model_config["api_model"]
        if provider == "openai":
            api_key = os.environ.get("OPENAI_API_KEY")
            if not api_key:
                self.send_json(503, {"error": "GPT Image 2 사용을 위한 OPENAI_API_KEY가 설정되지 않았습니다."})
                return
            upstream_url = (
                OPENAI_IMAGE_EDITS_URL
                if reference_images else OPENAI_IMAGES_URL
            )
            payload = {
                "model": api_model, "prompt": prompt.strip(), "n": 1,
                "quality": "auto",
                "size": self.openai_image_size(aspect_ratio, resolution),
                "output_format": output_format,
            }
            if reference_images:
                request_body, content_type = create_openai_edit_multipart(
                    payload, reference_images
                )
            else:
                request_body = json.dumps(payload).encode("utf-8")
                content_type = "application/json"
            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": content_type}
        elif provider == "google":
            api_key = os.environ.get("GEMINI_API_KEY")
            if not api_key:
                self.send_json(503, {"error": "Nano Banana 사용을 위한 GEMINI_API_KEY가 설정되지 않았습니다."})
                return
            upstream_url = GEMINI_INTERACTIONS_URL
            interaction_input = [{"type": "text", "text": prompt.strip()}]
            for reference in reference_images:
                header, encoded = reference["dataUrl"].split(",", 1)
                mime_type = header.split(":", 1)[1].split(";", 1)[0]
                interaction_input.append({
                    "type": "image",
                    "mime_type": mime_type,
                    "data": encoded,
                })
            payload = {
                "model": api_model,
                "input": interaction_input,
                "response_format": {
                    "type": "image",
                    "mime_type": f"image/{'jpeg' if output_format == 'jpeg' else output_format}",
                    "aspect_ratio": aspect_ratio,
                    "image_size": resolution,
                },
            }
            headers = {"x-goog-api-key": api_key, "Content-Type": "application/json"}
            request_body = json.dumps(payload).encode("utf-8")
        else:
            api_key = os.environ.get("ARK_API_KEY")
            if not api_key:
                self.send_json(503, {"error": "Seedream 사용을 위한 ARK_API_KEY가 설정되지 않았습니다."})
                return
            upstream_url = SEEDREAM_GENERATE_URL
            payload = {
                "model": api_model,
                "prompt": f"{prompt.strip()}\n\nOutput aspect ratio: {aspect_ratio}.",
                "size": resolution,
                "output_format": output_format, "watermark": False,
                "response_format": "b64_json",
            }
            if reference_images:
                payload["image"] = [reference["dataUrl"] for reference in reference_images]
            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
            request_body = json.dumps(payload).encode("utf-8")

        upstream_request = urllib.request.Request(
            upstream_url,
            data=request_body,
            headers=headers,
            method="POST",
        )

        try:
            with safe_urlopen(upstream_request, timeout=240) as response:
                response_data = json.loads(response.read().decode("utf-8"))
            image_base64, response_format = self.extract_generated_image(
                provider, response_data, output_format
            )
            if not image_base64:
                self.send_json(502, {"error": "이미지 API가 이미지 데이터를 반환하지 않았습니다."})
                return
            self.send_json(200, {
                "created": response_data.get("created"),
                "model": model,
                "provider": provider,
                "imageBase64": image_base64,
                "outputFormat": response_format,
                "aspectRatio": aspect_ratio,
                "resolution": resolution,
                "usage": response_data.get("usage"),
            })
        except urllib.error.HTTPError as error:
            provider_label = {
                "openai": "OpenAI",
                "google": "Google",
                "byteplus": "BytePlus",
            }.get(provider, "이미지 공급자")
            try:
                raw_error = error.read().decode("utf-8", errors="replace")
                error_data = json.loads(raw_error)
                upstream_error = error_data.get("error", error_data)
                if isinstance(upstream_error, dict):
                    message = (
                        upstream_error.get("message")
                        or error_data.get("message")
                        or f"{provider_label} 이미지 생성 요청이 실패했습니다."
                    )
                    code = upstream_error.get("code") or error_data.get("code")
                else:
                    message = str(upstream_error)
                    code = error_data.get("code")
            except json.JSONDecodeError:
                message = f"{provider_label} 이미지 생성 요청이 실패했습니다. (HTTP {error.code})"
                code = None
            self.send_json(error.code, {
                "error": message,
                "code": code,
                "provider": provider,
                "upstreamStatus": error.code,
            })
        except (urllib.error.URLError, TimeoutError):
            self.send_json(502, {"error": "이미지 생성 서버에 연결하지 못했습니다."})
        except json.JSONDecodeError:
            self.send_json(502, {"error": "이미지 API가 올바르지 않은 응답을 반환했습니다."})
        except Exception as error:
            print(f"이미지 생성 처리 오류: {error}")
            self.send_json(500, {"error": "이미지 생성 처리 중 서버 오류가 발생했습니다."})

    @staticmethod
    def openai_image_size(aspect_ratio, resolution):
        sizes = {
            "1K": {"1:1": "1024x1024", "16:9": "1376x768", "9:16": "768x1376", "4:3": "1200x896", "3:4": "896x1200"},
            "2K": {"1:1": "2048x2048", "16:9": "2752x1536", "9:16": "1536x2752", "4:3": "2400x1792", "3:4": "1792x2400"},
            "4K": {"1:1": "2880x2880", "16:9": "3840x2160", "9:16": "2160x3840", "4:3": "3264x2448", "3:4": "2448x3264"},
        }
        return sizes[resolution][aspect_ratio]

    @staticmethod
    def extract_generated_image(provider, response_data, fallback_format):
        if provider in {"openai", "byteplus"}:
            image = (response_data.get("data") or [{}])[0]
            encoded = image.get("b64_json", "")
            if not encoded and image.get("url"):
                with safe_urlopen(image["url"], timeout=120) as response:
                    encoded = base64.b64encode(response.read()).decode("ascii")
            return encoded, fallback_format
        output_image = response_data.get("output_image") or {}
        if output_image.get("data"):
            mime_type = output_image.get("mime_type", "")
            image_format = mime_type.split("/")[-1] if "/" in mime_type else fallback_format
            return output_image["data"], image_format
        for step in reversed(response_data.get("steps", [])):
            if step.get("type") != "model_output":
                continue
            for content in reversed(step.get("content", [])):
                if content.get("type") != "image" or not content.get("data"):
                    continue
                mime_type = content.get("mime_type", "")
                image_format = mime_type.split("/")[-1] if "/" in mime_type else fallback_format
                return content["data"], image_format
        for candidate in response_data.get("candidates", []):
            for part in candidate.get("content", {}).get("parts", []):
                inline_data = part.get("inlineData") or part.get("inline_data")
                if inline_data and inline_data.get("data"):
                    mime_type = inline_data.get("mimeType") or inline_data.get("mime_type", "")
                    image_format = mime_type.split("/")[-1] if "/" in mime_type else fallback_format
                    return inline_data["data"], image_format
        return "", fallback_format


def prompt_for_key(environment_name, message):
    if os.environ.get(environment_name):
        return False
    value = getpass.getpass(message).strip()
    if value:
        os.environ[environment_name] = value
        return True
    return False


if __name__ == "__main__":
    load_env_file()
    print()
    keys_changed = prompt_for_key(
        "OPENAI_API_KEY",
        "OpenAI API key (hidden, press Enter to skip): ",
    )
    keys_changed = prompt_for_key(
        "ANTHROPIC_API_KEY",
        "Anthropic API key for Claude (hidden, press Enter to skip): ",
    ) or keys_changed
    keys_changed = prompt_for_key(
        "GEMINI_API_KEY",
        "Gemini API key for Gemini and Nano Banana (hidden, press Enter to skip): ",
    ) or keys_changed
    keys_changed = prompt_for_key(
        "ARK_API_KEY",
        "BytePlus ModelArk API key for Seedream (hidden, press Enter to skip): ",
    ) or keys_changed
    keys_changed = prompt_for_key(
        "APIFRAME_API_KEY",
        "APIFRAME API key for Suno BGM (hidden, press Enter to skip): ",
    ) or keys_changed
    keys_changed = prompt_for_key(
        "WAVESPEED_API_KEY",
        "WaveSpeedAI API key for video generation (hidden, press Enter to skip): ",
    ) or keys_changed
    if keys_changed:
        try:
            save_env_file()
            print("API 키를 로컬 .env 파일에 저장했습니다. 다음 실행부터 자동으로 불러옵니다.")
        except OSError as error:
            print(f"API 키를 .env 파일에 저장하지 못했습니다: {error}")

    print()
    print("AI Video Studio 서버를 시작합니다.")
    print(f"브라우저 주소: http://localhost:{PORT}")
    print(f"OpenAI API 키: {'설정됨' if os.environ.get('OPENAI_API_KEY') else '설정되지 않음'}")
    print(f"Anthropic API 키: {'설정됨' if os.environ.get('ANTHROPIC_API_KEY') else '설정되지 않음'}")
    print(f"Gemini API 키: {'설정됨' if os.environ.get('GEMINI_API_KEY') else '설정되지 않음'}")
    print(f"BytePlus API 키: {'설정됨' if os.environ.get('ARK_API_KEY') else '설정되지 않음'}")
    print(f"APIFRAME API 키: {'설정됨' if os.environ.get('APIFRAME_API_KEY') else '설정되지 않음'}")
    print("종료하려면 Ctrl+C를 누르세요.")
    print()
    if not os.environ.get("AI_VIDEO_STUDIO_NO_BROWSER"):
        threading.Timer(0.8, lambda: webbrowser.open(f"http://localhost:{PORT}")).start()
    try:
        SingleInstanceHTTPServer((HOST, PORT), AppHandler).serve_forever()
    except OSError as error:
        if getattr(error, "winerror", None) == 10048 or getattr(error, "errno", None) in {48, 98}:
            print(f"이미 실행 중인 AI Video Studio 서버가 있습니다: http://localhost:{PORT}")
            print("기존 브라우저 창을 사용하거나 먼저 실행한 서버를 종료해 주세요.")
        else:
            raise
