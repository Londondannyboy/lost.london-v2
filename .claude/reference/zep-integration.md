# Zep Integration Reference

Load this when working on user memory, greetings, or personalization.

## Zep Cloud API (Thread-Based)

### Core Pattern
```python
from zep_cloud.client import AsyncZep

client = AsyncZep(api_key=os.environ.get("ZEP_API_KEY"))

# 1. Ensure user exists
await client.user.add(user_id=user_id, email=email)

# 2. Create thread for session
await client.thread.create(thread_id=thread_id, user_id=user_id)

# 3. Add messages to thread (stores conversation)
await client.thread.add_messages(
    thread_id=thread_id,
    messages=[{"role": "user", "content": message, "name": "User"}]
)

# 4. Get user context (retrieves relevant facts from ALL past threads)
context = await client.thread.get_user_context(thread_id)
# context.context = formatted string for prompt injection
# context.facts = list of extracted facts
```

### Key Functions in agent.py
| Function | Location | Purpose |
|----------|----------|---------|
| `get_zep_client()` | agent.py:359 | Singleton client |
| `ensure_user_exists()` | agent.py:372 | Create user if needed |
| `get_or_create_thread()` | agent.py:387 | Thread per session |
| `get_user_memory()` | agent.py:407 | Retrieve all context |
| `store_to_memory()` | agent.py:516 | Store conversation |
| `store_topic_interest()` | agent.py:557 | Store topic fact |

### Thread ID Convention
```python
thread_id = f"{user_id}-{session_id}"
```

### What Zep Returns
```python
{
    "found": True,
    "is_returning": True,  # Has past interactions
    "facts": ["Dan is interested in Royal Aquarium", ...],
    "topics": ["Royal Aquarium", "Thorney Island"],
    "user_name": "Dan",
    "context": "FACTS and ENTITIES relevant to conversation..."
}
```

## Greeting Flow

1. User clicks VIC → Hume sends "speak your greeting"
2. CLM endpoint detects `is_greeting_request`
3. Fetch Zep memory with `get_user_memory(user_id, thread_id)`
4. Call `generate_returning_user_greeting(name, topics, facts)`
5. Special cases: Vic = "brother from another mother", Dan = "son of Vic"

## Common Issues

### Memory Not Retrieved
- Check ZEP_API_KEY is set in Railway
- Verify user_id matches Clerk user ID
- Check thread exists: `client.thread.get(thread_id)`

### Topics Empty
- Topics extracted from facts via regex: `r'interested in ([A-Z][^.]+?)(?:\.|$)'`
- Store topics explicitly: `store_topic_interest(user_id, topic, user_name)`

### Greeting Not Personalized
- Check `is_returning` flag in debug endpoint
- Verify `generate_returning_user_greeting` is called (not hardcoded greeting)
