"""Memory management for conversation history."""
import json
import os
from datetime import datetime
from typing import Dict, List, Optional
from pathlib import Path


class ConversationMemory:
    """Manages conversation memory storage and retrieval."""

    def __init__(self, storage_dir: str = "conversations"):
        """
        Initialize conversation memory.

        Args:
            storage_dir: Directory to store conversation files
        """
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(exist_ok=True)
        self.conversations: Dict[str, List[Dict]] = {}
        self.load_existing_conversations()

    def load_existing_conversations(self):
        """Load existing conversations from storage."""
        for file_path in self.storage_dir.glob("*.json"):
            session_id = file_path.stem
            try:
                with open(file_path, 'r') as f:
                    self.conversations[session_id] = json.load(f)
            except Exception as e:
                print(f"Error loading conversation {session_id}: {e}")

    def get_or_create_session(self, session_id: str) -> List[Dict]:
        """
        Get existing session or create new one.

        Args:
            session_id: Unique session identifier

        Returns:
            List of conversation messages
        """
        if session_id not in self.conversations:
            self.conversations[session_id] = []
        return self.conversations[session_id]

    def add_interaction(self, session_id: str, user_input: str, assistant_response: str,
                       task_type: Optional[str] = None):
        """
        Add an interaction to the conversation memory.

        Args:
            session_id: Session identifier
            user_input: User's input/query
            assistant_response: Assistant's response
            task_type: Optional task type (explain, translate, summarize, etc.)
        """
        conversation = self.get_or_create_session(session_id)

        interaction = {
            "timestamp": datetime.now().isoformat(),
            "user": user_input,
            "assistant": assistant_response,
            "task_type": task_type
        }

        conversation.append(interaction)

        # Limit conversation history to last 50 interactions
        if len(conversation) > 50:
            conversation = conversation[-50:]
            self.conversations[session_id] = conversation

        # Save to file
        self.save_conversation(session_id)

    def save_conversation(self, session_id: str):
        """
        Save conversation to file.

        Args:
            session_id: Session identifier
        """
        file_path = self.storage_dir / f"{session_id}.json"
        try:
            with open(file_path, 'w') as f:
                json.dump(self.conversations[session_id], f, indent=2)
        except Exception as e:
            print(f"Error saving conversation {session_id}: {e}")

    def get_context(self, session_id: str, max_messages: int = 10) -> str:
        """
        Get conversation context as formatted string.

        Args:
            session_id: Session identifier
            max_messages: Maximum number of recent messages to include

        Returns:
            Formatted conversation context
        """
        conversation = self.get_or_create_session(session_id)

        if not conversation:
            return ""

        # Get recent messages
        recent_messages = conversation[-max_messages:] if len(conversation) > max_messages else conversation

        context_parts = []
        for msg in recent_messages:
            context_parts.append(f"User: {msg['user']}")
            context_parts.append(f"Assistant: {msg['assistant']}")

        return "\n".join(context_parts)

    def get_summary(self, session_id: str) -> Dict:
        """
        Get conversation summary statistics.

        Args:
            session_id: Session identifier

        Returns:
            Summary dictionary with statistics
        """
        conversation = self.get_or_create_session(session_id)

        if not conversation:
            return {
                "total_interactions": 0,
                "session_start": None,
                "last_interaction": None,
                "task_types": {}
            }

        task_counts = {}
        for msg in conversation:
            task_type = msg.get("task_type", "general")
            task_counts[task_type] = task_counts.get(task_type, 0) + 1

        return {
            "total_interactions": len(conversation),
            "session_start": conversation[0]["timestamp"] if conversation else None,
            "last_interaction": conversation[-1]["timestamp"] if conversation else None,
            "task_types": task_counts
        }

    def clear_session(self, session_id: str):
        """
        Clear a specific session's memory.

        Args:
            session_id: Session identifier
        """
        if session_id in self.conversations:
            del self.conversations[session_id]

        file_path = self.storage_dir / f"{session_id}.json"
        if file_path.exists():
            file_path.unlink()

    def list_sessions(self) -> List[str]:
        """
        List all available session IDs.

        Returns:
            List of session IDs
        """
        return list(self.conversations.keys())


# Global memory instance
memory_store = ConversationMemory()