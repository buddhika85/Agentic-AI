import json
import logging
import os
import re

import httpx

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "openai/gpt-oss-120b:free"

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a Kanban board assistant. You help users manage their project board.

The current board state is provided as JSON. The user will ask you to create, edit, move, or delete cards.

Respond in JSON format with this exact structure:
{
  "message": "Your conversational response to the user",
  "board_update": {
    "columns": [
      {
        "id": "column-id",
        "title": "Column Title",
        "position": 0,
        "cards": [
          {"id": "card-id", "title": "Card Title", "details": "Card details", "position": 0}
        ]
      }
    ]
  }
}

Rules:
- Always include the full board state in "board_update" with ALL columns and cards
- Keep existing column IDs unchanged unless renaming a column
- Generate new card IDs using format "card-XXXX" where XXXX is random alphanumeric
- Only modify what the user asked about; keep everything else unchanged
- If the user just asks a question without board changes, still return the full board state unchanged
- Return ONLY the JSON object, no markdown, no explanation outside the JSON"""


def call_openrouter(messages: list[dict], max_tokens: int = 2048, timeout: int = 60) -> str:
    if not OPENROUTER_API_KEY:
        raise ValueError("OPENROUTER_API_KEY is not set")

    payload = {
        "model": MODEL,
        "messages": messages,
        "max_tokens": max_tokens,
    }

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:8000",
        "X-Title": "Kanban Studio",
    }

    logger.info("Sending OpenRouter request: model=%s, messages=%d", MODEL, len(messages))
    logger.debug("Payload: %s", json.dumps(payload))

    with httpx.Client(timeout=timeout) as client:
        response = client.post(OPENROUTER_API_URL, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()

    logger.info("Received OpenRouter response: id=%s", data.get("id", "unknown"))
    logger.debug("Response: %s", json.dumps(data))

    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as e:
        logger.error("Failed to parse OpenRouter response: %s", e)
        raise ValueError("Invalid response format from OpenRouter") from e


def extract_json(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
        text = text.strip()
    return text


def parse_ai_response(raw_text: str) -> dict:
    cleaned = extract_json(raw_text)
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as e:
        logger.error("Failed to parse AI response as JSON: %s", e)
        raise ValueError("AI response is not valid JSON") from e

    if "message" not in data:
        raise ValueError("AI response missing 'message' field")

    result = {"message": data["message"], "board_update": None}

    if "board_update" in data and data["board_update"]:
        from db import validate_board
        board_data = data["board_update"]
        errors = validate_board(board_data)
        if errors:
            logger.warning("AI board update failed validation: %s", errors)
            result["validation_errors"] = errors
        else:
            result["board_update"] = board_data

    return result


def build_chat_messages(user_message: str, board_state: dict | None = None) -> list[dict]:
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    if board_state:
        board_json = json.dumps(board_state, indent=2)
        messages.append({
            "role": "user",
            "content": f"Current board state:\n```json\n{board_json}\n```\n\nUser request: {user_message}",
        })
    else:
        messages.append({"role": "user", "content": user_message})
    return messages
