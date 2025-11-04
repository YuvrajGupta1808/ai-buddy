"""FastAPI backend service with LangChain agent."""
import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from agent import run_task

# Load environment variables
load_dotenv()

app = FastAPI(title="AI Buddy Backend", version="1.0.0")


class RunRequest(BaseModel):
    """Request model for /run endpoint."""
    task: str = Field(..., description="Task type: summarize, websearch, or translate")
    text: str = Field(..., description="Text input for the task")


class RunResponse(BaseModel):
    """Response model for /run endpoint."""
    message: str = Field(..., description="Status message about changes made")
    result: str = Field(..., description="The actual result/text returned")
    task: str


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "AI Buddy Backend Service", "status": "running"}


@app.post("/run", response_model=RunResponse)
async def run(request: RunRequest):
    """
    Execute a task using the LangChain agent.
    
    Args:
        request: Request containing task type and text input
    
    Returns:
        Response with the task result
    """
    # Validate task
    valid_tasks = ["summarize", "websearch", "translate"]
    if request.task not in valid_tasks:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid task '{request.task}'. Must be one of {valid_tasks}"
        )
    
    try:
        task_result = run_task(request.task, request.text)
        return RunResponse(
            message=task_result.get("message", "Task completed"),
            result=task_result.get("result", ""),
            task=request.task
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)

