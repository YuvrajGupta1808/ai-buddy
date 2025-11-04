"""FastAPI backend service with LangChain agent and memory."""
import os
import uuid
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from agent import run_task, run_natural_language_task, process_natural_language_request
from memory import memory_store

# Load environment variables
load_dotenv()

app = FastAPI(title="AI Buddy Backend", version="1.0.0")


class RunRequest(BaseModel):
    """Request model for /run endpoint - supports both structured and natural language."""
    task: str = Field(None, description="Natural language task or question (e.g., 'explain this', 'summarize', 'what does this mean?')")
    text: str = Field(None, description="Text input to process")
    query: str = Field(None, description="Alternative: Full natural language query")
    session_id: str = Field(None, description="Optional: Session ID for conversation memory")


class RunResponse(BaseModel):
    """Response model for /run endpoint."""
    result: str
    session_id: str = None


class MemoryRequest(BaseModel):
    """Request model for memory operations."""
    session_id: str = Field(..., description="Session ID")


class MemoryResponse(BaseModel):
    """Response model for memory operations."""
    session_id: str
    summary: dict = None
    context: str = None
    message: str = None


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "AI Buddy Backend Service with Memory", "status": "running"}


@app.post("/run", response_model=RunResponse)
async def run(request: RunRequest):
    """
    Execute tasks using AI agent with memory support.

    The AI will intelligently decide whether to:
    - Use tools (summarize, search, translate)
    - Provide direct answers (explain, analyze, etc.)

    Memory Support:
    - Include session_id to maintain conversation context
    - If no session_id is provided, a new one will be created
    - The AI will remember previous interactions in the session

    Examples:
    1. With session memory:
       {"session_id": "user123", "query": "What did we talk about earlier?"}

    2. Natural language query:
       {"query": "Explain what machine learning is"}

    3. Task + Text format:
       {"task": "translate to Spanish", "text": "Hello world"}

    Args:
        request: Request with optional session_id for memory

    Returns:
        Response with result and session_id
    """
    # Generate session_id if not provided
    session_id = request.session_id or str(uuid.uuid4())

    try:
        # Prepare the full query
        if request.query:
            user_input = request.query
            result = process_natural_language_request(user_input, session_id=session_id)

        elif request.task:
            user_input = f"{request.task} {request.text or ''}"
            # Include session context for task-based requests
            result = process_natural_language_request(request.task, request.text, session_id)

        else:
            raise HTTPException(
                status_code=400,
                detail="Request must include either 'query' or 'task' parameter"
            )

        # Store interaction in memory
        memory_store.add_interaction(
            session_id=session_id,
            user_input=user_input,
            assistant_response=result,
            task_type=request.task if request.task else "general"
        )

        return RunResponse(result=result, session_id=session_id)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.get("/memory/{session_id}", response_model=MemoryResponse)
async def get_memory(session_id: str):
    """
    Get conversation memory for a session.

    Args:
        session_id: Session identifier

    Returns:
        Memory summary and recent context
    """
    summary = memory_store.get_summary(session_id)
    context = memory_store.get_context(session_id, max_messages=10)

    return MemoryResponse(
        session_id=session_id,
        summary=summary,
        context=context
    )


@app.delete("/memory/{session_id}", response_model=MemoryResponse)
async def clear_memory(session_id: str):
    """
    Clear conversation memory for a session.

    Args:
        session_id: Session identifier

    Returns:
        Confirmation message
    """
    memory_store.clear_session(session_id)

    return MemoryResponse(
        session_id=session_id,
        message=f"Memory cleared for session {session_id}"
    )


@app.get("/sessions")
async def list_sessions():
    """
    List all available sessions.

    Returns:
        List of session IDs
    """
    return {"sessions": memory_store.list_sessions()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)