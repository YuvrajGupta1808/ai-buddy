"""Agent executor setup with natural language understanding."""
import os
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.agents import AgentExecutor, initialize_agent, AgentType
from tools import SummarizeTool, WebSearchTool, TranslateTool
from memory import memory_store


def create_agent_executor() -> AgentExecutor:
    """Create and return an AgentExecutor with all tools."""
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_API_KEY environment variable is required")

    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash-lite",
        google_api_key=api_key,
        temperature=0.7,
    )

    # Initialize tools
    summarize_tool = SummarizeTool(llm=llm)
    web_search_tool = WebSearchTool()
    translate_tool = TranslateTool(llm=llm)

    tools = [summarize_tool, web_search_tool, translate_tool]

    # Create the agent executor
    executor = initialize_agent(
        tools=tools,
        llm=llm,
        agent=AgentType.ZERO_SHOT_REACT_DESCRIPTION,
        verbose=True,
        handle_parsing_errors=True,
        max_iterations=10,
    )

    return executor


def extract_translation_details(request: str) -> tuple[str, str]:
    """
    Extract the target language from a translation request.

    Args:
        request: The translation request

    Returns:
        Tuple of (target_language, text_to_translate)
    """
    request_lower = request.lower()

    # Common patterns for translation requests
    language_keywords = {
        'spanish': 'Spanish', 'español': 'Spanish',
        'french': 'French', 'français': 'French',
        'german': 'German', 'deutsch': 'German', 'allemand': 'German',
        'italian': 'Italian', 'italiano': 'Italian',
        'portuguese': 'Portuguese', 'português': 'Portuguese',
        'russian': 'Russian', 'русский': 'Russian',
        'japanese': 'Japanese', '日本語': 'Japanese',
        'chinese': 'Chinese', '中文': 'Chinese', 'mandarin': 'Chinese',
        'korean': 'Korean', '한국어': 'Korean',
        'arabic': 'Arabic', 'عربي': 'Arabic',
        'hindi': 'Hindi', 'हिन्दी': 'Hindi',
        'dutch': 'Dutch', 'nederlands': 'Dutch',
        'swedish': 'Swedish', 'svenska': 'Swedish',
        'polish': 'Polish', 'polski': 'Polish',
        'turkish': 'Turkish', 'türkçe': 'Turkish',
        'greek': 'Greek', 'ελληνικά': 'Greek',
        'hebrew': 'Hebrew', 'עברית': 'Hebrew',
        'english': 'English'
    }

    # Default to English if no specific language is mentioned
    target_language = "English"

    # Check for language mentions
    for keyword, language in language_keywords.items():
        if keyword in request_lower:
            target_language = language
            break

    # Check for patterns like "to Spanish", "in French", etc.
    for pattern in [' to ', ' in ', ' into ']:
        if pattern in request_lower:
            parts = request_lower.split(pattern)
            if len(parts) > 1:
                for keyword, language in language_keywords.items():
                    if keyword in parts[1]:
                        target_language = language
                        break

    return target_language


def process_natural_language_request(user_query: str, context: str = None, session_id: str = None) -> str:
    """
    Process any natural language request intelligently.
    The LLM will decide whether to use tools or provide a direct answer.

    Args:
        user_query: The user's natural language request
        context: Optional context (like text to analyze)

    Returns:
        The result from either tools or direct LLM response
    """
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_API_KEY environment variable is required")

    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash-lite",
        google_api_key=api_key,
        temperature=0.7,
    )

    # Get conversation history if session_id is provided
    conversation_context = ""
    if session_id:
        conversation_context = memory_store.get_context(session_id, max_messages=5)

    # Create the full query with context if provided
    if context:
        full_query = f"{user_query}\n\nContext/Text: {context}"
    else:
        full_query = user_query

    # Add conversation history to context if available
    if conversation_context:
        full_query = f"Previous conversation:\n{conversation_context}\n\nCurrent request: {full_query}"

    # First, determine if we need to use tools or can answer directly
    decision_prompt = f"""
    Analyze this user request and determine the best way to handle it:

    User request: "{full_query}"

    Decide which approach to take:
    1. USE_TOOLS - If the request requires:
       - Summarizing text (making it shorter, extracting key points)
       - Searching the web for current/factual information
       - Translating between languages

    2. DIRECT_ANSWER - If the request is:
       - Asking for explanation or clarification
       - General knowledge questions
       - Analysis or interpretation
       - Creative tasks
       - Math or reasoning
       - Any other request that doesn't specifically need the above tools

    Also, if it's a translation request, identify the target language.

    Respond in this format:
    APPROACH: [USE_TOOLS/DIRECT_ANSWER]
    TARGET_LANGUAGE: [language if translation, otherwise NONE]
    REFORMULATED_REQUEST: [clearer version of the request]

    Examples:
    - "explain what this means: [text]" -> APPROACH: DIRECT_ANSWER, TARGET_LANGUAGE: NONE
    - "translate this to Spanish: hello" -> APPROACH: USE_TOOLS, TARGET_LANGUAGE: Spanish
    - "summarize this article: [text]" -> APPROACH: USE_TOOLS, TARGET_LANGUAGE: NONE
    - "what is machine learning?" -> APPROACH: DIRECT_ANSWER, TARGET_LANGUAGE: NONE
    - "find latest news about AI" -> APPROACH: USE_TOOLS, TARGET_LANGUAGE: NONE
    - "translate hello to French" -> APPROACH: USE_TOOLS, TARGET_LANGUAGE: French
    - "explain this code" -> APPROACH: DIRECT_ANSWER, TARGET_LANGUAGE: NONE
    """

    decision_response = llm.invoke(decision_prompt)
    decision_text = decision_response.content if hasattr(decision_response, 'content') else str(decision_response)

    # Parse the decision
    approach = "DIRECT_ANSWER"  # Default
    target_language = "NONE"
    reformulated_request = full_query

    for line in decision_text.strip().split('\n'):
        if line.startswith("APPROACH:"):
            approach = line.replace("APPROACH:", "").strip()
        elif line.startswith("TARGET_LANGUAGE:"):
            target_language = line.replace("TARGET_LANGUAGE:", "").strip()
        elif line.startswith("REFORMULATED_REQUEST:"):
            reformulated_request = line.replace("REFORMULATED_REQUEST:", "").strip()

    # Execute based on approach
    if approach == "USE_TOOLS":
        # Check if it's a translation request with specific language
        if target_language != "NONE" and "translat" in user_query.lower():
            # Handle translation with specific target language
            if target_language.lower() == "english":
                prompt = f"Translate the following text to English: {context if context else user_query}"
            else:
                # Direct translation to specified language
                translation_prompt = f"""
                Translate the following text to {target_language}.
                Only provide the translation, no explanations.

                Text: {context if context else user_query}
                """
                response = llm.invoke(translation_prompt)
                return response.content if hasattr(response, 'content') else str(response)

        # Use the agent with tools for other cases
        executor = create_agent_executor()
        result = executor.invoke({"input": reformulated_request})
        return result.get("output", "No output generated")
    else:
        # Provide direct answer without tools
        direct_prompt = f"""
        Please provide a helpful response to this request:

        {full_query}

        Be clear, informative, and directly address what the user is asking for.
        """

        response = llm.invoke(direct_prompt)
        return response.content if hasattr(response, 'content') else str(response)


def run_natural_language_task(query: str) -> str:
    """
    Process a natural language query using the agent.
    This is a wrapper for backward compatibility.

    Args:
        query: Natural language query from the user

    Returns:
        The result of the task execution
    """
    return process_natural_language_request(query)


def run_task(task: str, text: str) -> str:
    """
    Run a task using natural language processing.
    Now accepts any natural language as the task parameter.

    Args:
        task: Natural language description of what to do
        text: The text input to process

    Returns:
        The result of the task execution
    """
    # For translation requests, detect target language from task
    task_lower = task.lower()

    # Check if it's a translation request
    if any(word in task_lower for word in ['translat', 'convert', 'say', 'write', 'express']):
        target_lang = extract_translation_details(task)

        # Handle translation for any language (including English as default)
        api_key = os.getenv("GOOGLE_API_KEY")
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash-lite",
            google_api_key=api_key,
            temperature=0.7,
        )

        translation_prompt = f"""
        Task: {task}

        Translate this text to {target_lang}: {text}

        Provide only the translation, no explanations.
        """
        response = llm.invoke(translation_prompt)
        return response.content if hasattr(response, 'content') else str(response)

    # For all other requests, use the normal flow
    return process_natural_language_request(task, text)