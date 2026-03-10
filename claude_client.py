import json
import anthropic
from models import FoodEntry

SYSTEM_PROMPT = """You are a nutrition analysis assistant. Given a natural language description of food, return ONLY a JSON object with these exact fields:

{
  "food_name": "descriptive name of the food",
  "calories": <number>,
  "protein_g": <number>,
  "carbs_g": <number>,
  "fat_g": <number>,
  "serving_size_g": <number or null>,
  "notes": "<string or null>"
}

Rules:
- Return ONLY the JSON object. No markdown, no explanation, no code fences.
- All numeric values should be rounded to 1 decimal place.
- If the user specifies a weight (e.g., "200g chicken"), use that as serving_size_g and calculate macros for that weight.
- If no weight is specified, estimate a reasonable single serving and note your assumption in "notes".
- For branded/restaurant foods, use your best knowledge of their nutritional content.
- For ambiguous inputs, make reasonable assumptions and document them in "notes".
- If the user mentions multiple foods in one entry, combine them into a single entry with a descriptive food_name and summed macros."""


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


async def parse_food(text: str, saved_meals: list[dict]) -> FoodEntry:
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
        return FoodEntry(**data)
    except (json.JSONDecodeError, ValueError) as e:
        raise ValueError(f"Failed to parse Claude response: {e}\nRaw: {content}")
