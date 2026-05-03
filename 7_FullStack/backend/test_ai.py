import pytest
from unittest.mock import patch, MagicMock
import ai


def test_call_openrouter_raises_if_no_key():
    original = ai.OPENROUTER_API_KEY
    ai.OPENROUTER_API_KEY = ""
    try:
        with pytest.raises(ValueError, match="OPENROUTER_API_KEY is not set"):
            ai.call_openrouter([{"role": "user", "content": "hello"}])
    finally:
        ai.OPENROUTER_API_KEY = original


def test_call_openrouter_success():
    original = ai.OPENROUTER_API_KEY
    ai.OPENROUTER_API_KEY = "test-key"
    try:
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "id": "resp-123",
            "choices": [{"message": {"content": "4"}}],
        }
        mock_response.raise_for_status = MagicMock()

        with patch("ai.httpx.Client") as MockClient:
            mock_client = MagicMock()
            mock_client.post.return_value = mock_response
            MockClient.return_value.__enter__ = MagicMock(return_value=mock_client)
            MockClient.return_value.__exit__ = MagicMock(return_value=False)

            result = ai.call_openrouter([{"role": "user", "content": "2+2"}])
            assert result == "4"
            mock_client.post.assert_called_once()
            call_args = mock_client.post.call_args
            assert call_args[1]["json"]["model"] == ai.MODEL
            assert "Authorization" in call_args[1]["headers"]
    finally:
        ai.OPENROUTER_API_KEY = original


def test_call_openrouter_bad_response_format():
    original = ai.OPENROUTER_API_KEY
    ai.OPENROUTER_API_KEY = "test-key"
    try:
        mock_response = MagicMock()
        mock_response.json.return_value = {"unexpected": "format"}
        mock_response.raise_for_status = MagicMock()

        with patch("ai.httpx.Client") as MockClient:
            mock_client = MagicMock()
            mock_client.post.return_value = mock_response
            MockClient.return_value.__enter__ = MagicMock(return_value=mock_client)
            MockClient.return_value.__exit__ = MagicMock(return_value=False)

            with pytest.raises(ValueError, match="Invalid response format"):
                ai.call_openrouter([{"role": "user", "content": "test"}])
    finally:
        ai.OPENROUTER_API_KEY = original


def test_call_openrouter_http_error():
    original = ai.OPENROUTER_API_KEY
    ai.OPENROUTER_API_KEY = "test-key"
    try:
        mock_response = MagicMock()
        mock_response.raise_for_status.side_effect = Exception("API down")

        with patch("ai.httpx.Client") as MockClient:
            mock_client = MagicMock()
            mock_client.post.return_value = mock_response
            MockClient.return_value.__enter__ = MagicMock(return_value=mock_client)
            MockClient.return_value.__exit__ = MagicMock(return_value=False)

            with pytest.raises(Exception, match="API down"):
                ai.call_openrouter([{"role": "user", "content": "test"}])
    finally:
        ai.OPENROUTER_API_KEY = original


def test_call_openrouter_sends_correct_headers():
    original = ai.OPENROUTER_API_KEY
    ai.OPENROUTER_API_KEY = "my-secret-key"
    try:
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "id": "resp-1",
            "choices": [{"message": {"content": "ok"}}],
        }
        mock_response.raise_for_status = MagicMock()

        with patch("ai.httpx.Client") as MockClient:
            mock_client = MagicMock()
            mock_client.post.return_value = mock_response
            MockClient.return_value.__enter__ = MagicMock(return_value=mock_client)
            MockClient.return_value.__exit__ = MagicMock(return_value=False)

            ai.call_openrouter([{"role": "user", "content": "hi"}])
            headers = mock_client.post.call_args[1]["headers"]
            assert headers["Authorization"] == "Bearer my-secret-key"
            assert headers["HTTP-Referer"] == "http://localhost:8000"
            assert headers["X-Title"] == "Kanban Studio"
    finally:
        ai.OPENROUTER_API_KEY = original


def test_model_constant():
    assert ai.MODEL == "openai/gpt-oss-120b:free"


def test_api_url_constant():
    assert ai.OPENROUTER_API_URL == "https://openrouter.ai/api/v1/chat/completions"


def test_extract_json_plain():
    text = '{"message": "hello", "board_update": null}'
    assert ai.extract_json(text) == text


def test_extract_json_code_block():
    text = '```json\n{"message": "hello"}\n```'
    result = ai.extract_json(text)
    assert result == '{"message": "hello"}'


def test_extract_json_code_block_no_lang():
    text = '```\n{"message": "hello"}\n```'
    result = ai.extract_json(text)
    assert result == '{"message": "hello"}'


def test_parse_ai_response_valid():
    raw = '{"message": "Done", "board_update": {"columns": [{"id": "c1", "title": "T", "position": 0, "cards": []}]}}'
    result = ai.parse_ai_response(raw)
    assert result["message"] == "Done"
    assert result["board_update"] is not None


def test_parse_ai_response_no_board_update():
    raw = '{"message": "Sure, I can help"}'
    result = ai.parse_ai_response(raw)
    assert result["message"] == "Sure, I can help"
    assert result["board_update"] is None


def test_parse_ai_response_invalid_json():
    with pytest.raises(ValueError, match="not valid JSON"):
        ai.parse_ai_response("this is not json")


def test_parse_ai_response_missing_message():
    with pytest.raises(ValueError, match="missing 'message' field"):
        ai.parse_ai_response('{"board_update": {}}')


def test_parse_ai_response_invalid_board():
    raw = '{"message": "Updated", "board_update": {"columns": []}}'
    result = ai.parse_ai_response(raw)
    assert result["board_update"] is None
    assert "validation_errors" in result


def test_build_chat_messages_with_board():
    board = {"columns": [{"id": "c1", "title": "To Do", "cards": []}]}
    messages = ai.build_chat_messages("Add a card", board)
    assert messages[0]["role"] == "system"
    assert "To Do" in messages[1]["content"]
    assert "Add a card" in messages[1]["content"]


def test_build_chat_messages_without_board():
    messages = ai.build_chat_messages("Hello")
    assert len(messages) == 2
    assert messages[1]["content"] == "Hello"
