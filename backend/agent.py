"""Agent executor setup with dynamic tool selection."""
import os
import json
import re
from typing import Dict
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


def run_task(task: str, text: str) -> Dict[str, str]:
    """
    Run a task using the agent executor.
    
    Args:
        task: One of ["summarize", "websearch", "translate"]
        text: The text input
    
    Returns:
        Dictionary with "message" and "result" keys
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
    agent_result = executor.invoke({"input": prompt})
    
    # Extract the output from the agent
    output = agent_result.get("output", "No output generated")
    
    # Extract the actual result from tool output if available
    result_text = output
    intermediate_steps = agent_result.get("intermediate_steps", [])
    
    # Try to extract the result from tool output (JSON format)
    if intermediate_steps:
        for step in reversed(intermediate_steps):
            if len(step) >= 2:
                tool_output = step[1]
                try:
                    parsed = json.loads(tool_output)
                    if isinstance(parsed, dict) and "result" in parsed:
                        result_text = parsed.get("result", output)
                        break
                except:
                    pass
    
    # Use LLM to generate a dynamic message based on what actually happened
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_API_KEY environment variable is required")
    
    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash-lite",
        google_api_key=api_key,
        temperature=0.7,
    )
    
    # Generate a contextual message based on the task and result
    message_prompt = f"""Based on the following task and result, generate a brief, descriptive message (1-2 sentences) explaining what was accomplished. 
The message should be specific to what actually happened and should change based on the content of the result.

Task: {task}
Input: {text[:200]}...
Result: {result_text[:500]}...

Generate only a concise message describing what was done, starting with the action taken. For example:
- "Summarized the text into a concise overview highlighting the main points about..."
- "Found 3 relevant web search results for..."
- "Translated the text from [language] to English, preserving the meaning of..."

Message:"""
    
    try:
        message_response = llm.invoke(message_prompt)
        message = message_response.content if hasattr(message_response, 'content') else str(message_response)
        # Clean up the message (remove quotes if present)
        message = message.strip().strip('"').strip("'")
    except Exception as e:
        # Fallback message if LLM fails
        message = f"Completed {task} task successfully"
    
    return {
        "message": message,
        "result": result_text
    }

