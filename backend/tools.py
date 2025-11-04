"""LangChain tools for summarization, web search, and translation."""
import os
import requests
from typing import Optional
from langchain.tools import BaseTool
from pydantic import BaseModel, Field
from langchain_google_genai import ChatGoogleGenerativeAI


class SummarizeToolInput(BaseModel):
    """Input schema for SummarizeTool."""
    text: str = Field(description="The text to summarize")


class SummarizeTool(BaseTool):
    """Tool for summarizing text using Gemini."""
    name: str = "summarize"
    description: str = "Summarizes the given text concisely. Use this when the task is 'summarize'."
    args_schema: type[BaseModel] = SummarizeToolInput
    llm: Optional[ChatGoogleGenerativeAI] = None

    def __init__(self, llm: Optional[ChatGoogleGenerativeAI] = None):
        super().__init__()
        self.llm = llm

    def _run(self, text: str) -> str:
        """Summarize the given text."""
        if not self.llm:
            return "Error: LLM not initialized"
        
        prompt = f"Please provide a concise summary of the following text:\n\n{text}\n\nSummary:"
        response = self.llm.invoke(prompt)
        return response.content if hasattr(response, 'content') else str(response)


class WebSearchToolInput(BaseModel):
    """Input schema for WebSearchTool."""
    query: str = Field(description="The search query")


class WebSearchTool(BaseTool):
    """Tool for performing web searches using Serper API."""
    name: str = "web_search"
    description: str = "Performs a web search and returns top 3 results. Use this when the task is 'websearch'."
    args_schema: type[BaseModel] = WebSearchToolInput
    serper_api_key: Optional[str] = None

    def __init__(self):
        super().__init__()
        self.serper_api_key = os.getenv("SERPER_API_KEY")
        if not self.serper_api_key:
            raise ValueError("SERPER_API_KEY environment variable is required")

    def _run(self, query: str) -> str:
        """Perform web search and return top 3 results."""
        try:
            url = "https://google.serper.dev/search"
            headers = {
                "X-API-KEY": self.serper_api_key,
                "Content-Type": "application/json"
            }
            payload = {
                "q": query,
                "num": 3
            }
            
            response = requests.post(url, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
            
            # Serper returns results in 'organic' field
            organic_results = data.get('organic', [])
            if not organic_results:
                return "No search results found."
            
            formatted_results = []
            for i, result in enumerate(organic_results[:3], 1):
                title = result.get('title', 'No title')
                snippet = result.get('snippet', 'No snippet')
                link = result.get('link', 'No link')
                formatted_results.append(f"{i}. {title}\n   {snippet}\n   {link}")
            
            return "\n\n".join(formatted_results)
        except Exception as e:
            return f"Error performing web search: {str(e)}"


class TranslateToolInput(BaseModel):
    """Input schema for TranslateTool."""
    text: str = Field(description="The text to translate to English")


class TranslateTool(BaseTool):
    """Tool for translating text using Gemini."""
    name: str = "translate"
    description: str = "Translates text to English. Use this when the task is 'translate'. The tool automatically detects the source language and translates to English."
    args_schema: type[BaseModel] = TranslateToolInput
    llm: Optional[ChatGoogleGenerativeAI] = None

    def __init__(self, llm: Optional[ChatGoogleGenerativeAI] = None):
        super().__init__()
        self.llm = llm

    def _run(self, text: str) -> str:
        """Translate the given text to English."""
        if not self.llm:
            return "Error: LLM not initialized"
        
        prompt = f"Translate the following text to English. Only return the translated text, no additional explanation:\n\n{text}"
        response = self.llm.invoke(prompt)
        return response.content if hasattr(response, 'content') else str(response)

