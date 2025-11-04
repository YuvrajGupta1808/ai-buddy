"""Agent executor setup with dynamic tool selection."""
import os
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.agents import AgentExecutor, initialize_agent, AgentType
from tools import SummarizeTool, WebSearchTool, TranslateTool


def create_agent_executor() -> AgentExecutor:
    """Create and return an AgentExecutor with all tools."""
    # Initialize Gemini 2.5 Flash Lite (using gemini-1.5-flash as fallback)
    # If you have access to gemini-2.5-flash-lite, update the model name accordingly
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_API_KEY environment variable is required")
    
    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash-lite",  # Update to "gemini-2.5-flash-lite" if available
        google_api_key=api_key,
        temperature=0.7,
    )
    
    # Initialize tools
    summarize_tool = SummarizeTool(llm=llm)
    web_search_tool = WebSearchTool()
    translate_tool = TranslateTool(llm=llm)
    
    tools = [summarize_tool, web_search_tool, translate_tool]
    
    # Create the agent executor using initialize_agent
    executor = initialize_agent(
        tools=tools,
        llm=llm,
        agent=AgentType.ZERO_SHOT_REACT_DESCRIPTION,
        verbose=True,
        handle_parsing_errors=True,
        max_iterations=10,
    )
    
    return executor


def run_task(task: str, text: str) -> str:
    """
    Run a task using the agent executor.
    
    Args:
        task: One of ["summarize", "websearch", "translate"]
        text: The text input
    
    Returns:
        The result of the task execution
    """
    executor = create_agent_executor()
    
    # Map task to a prompt that guides the agent to use the right tool
    task_prompts = {
        "summarize": f"Summarize the following text: {text}",
        "websearch": f"Perform a web search for: {text}. Return the top 3 results.",
        "translate": f"Translate the following text to English: {text}",
    }
    
    if task not in task_prompts:
        raise ValueError(f"Invalid task: {task}. Must be one of {list(task_prompts.keys())}")
    
    prompt = task_prompts[task]
    result = executor.invoke({"input": prompt})
    
    return result.get("output", "No output generated")

