import json
import anthropic
from models import FoodResult, ClarificationResult

SYSTEM_PROMPT = """You are a nutrition analysis assistant. Given a natural language description of food, you MUST self-assess your confidence in the nutritional estimate.

If you are at least 80% confident, return a JSON object with status "ok":

{
  "status": "ok",
  "confidence": <0.0-1.0>,
  "food_name": "descriptive name of the food",
  "calories": <number>,
  "protein_g": <number>,
  "carbs_g": <number>,
  "fat_g": <number>,
  "serving_size_g": <number or null>,
  "notes": "<string or null>"
}

If you are less than 80% confident because the input is vague, ambiguous, or missing critical information, return a JSON object with status "clarify":

{
  "status": "clarify",
  "confidence": <0.0-1.0>,
  "message": "A specific, friendly question asking the user to clarify"
}

Rules:
- Return ONLY the JSON object. No markdown, no explanation, no code fences.
- All numeric values should be rounded to 1 decimal place.
- If the user specifies a weight (e.g., "200g chicken"), use that as serving_size_g and calculate macros for that weight.
- If no weight is specified but a reasonable default exists (e.g., "an apple" → ~180g medium apple), use it and note the assumption in "notes". Do NOT ask for clarification in these cases.
- For branded/restaurant foods, use your best knowledge of their nutritional content.
- If the user mentions multiple foods in one entry, combine them into a single entry with a descriptive food_name and summed macros.
- If the input is not food-related or is nonsensical, return a clarify response.

When to ask for clarification:
- The food identity is ambiguous (e.g., "chicken" — breast? thigh? fried? grilled?)
- The portion could vary wildly and no reasonable default exists (e.g., "pasta" without any size indication)
- The input references a specific brand or restaurant dish you cannot identify
- Multiple conflicting interpretations exist

When NOT to ask for clarification:
- A reasonable single-serving default exists (e.g., "a banana", "2 eggs", "a slice of pizza")
- The user gave enough detail to estimate within 80% accuracy
- The food matches a saved meal profile"""


def _build_saved_meals_context(saved_meals: list[dict]) -> str:
    if not saved_meals:
        return ""
    rows = []
    for m in saved_meals:
        rows.append(
            f"| {m['name']} | {m['calories_per_100g']} | {m['protein_per_100g']} "
            f"| {m['carbs_per_100g']} | {m['fat_per_100g']} | {m['default_serving_g']}g |"
        )
    table = "\n".join(rows)
    return (
        "\n\nThe user has the following saved meal profiles. If they reference any of "
        "these by name, use the saved nutritional data instead of estimating:\n\n"
        "| Name | Cal/100g | Protein/100g | Carbs/100g | Fat/100g | Default Serving |\n"
        "|------|----------|-------------|------------|---------|----------------|\n"
        f"{table}\n\n"
        "When the user references a saved meal, calculate macros based on the per-100g "
        "values and the serving size they specify (or the default serving if none specified)."
    )


async def parse_food(text: str, saved_meals: list[dict]) -> FoodResult | ClarificationResult:
    client = anthropic.AsyncAnthropic()
    system = SYSTEM_PROMPT + _build_saved_meals_context(saved_meals)

    try:
        response = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            temperature=0,
            system=system,
            messages=[{"role": "user", "content": text}],
        )
    except anthropic.APIError as e:
        raise ValueError(f"Claude API error: {e}")

    content = response.content[0].text.strip()
    # Strip markdown code fences if present
    if content.startswith("```"):
        content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    try:
        data = json.loads(content)
        if data.get("status") == "clarify":
            return ClarificationResult(**data)
        return FoodResult(**data)
    except (json.JSONDecodeError, ValueError) as e:
        raise ValueError(f"Failed to parse Claude response: {e}\nRaw: {content}")
