from pydantic import BaseModel
from typing import Optional


class CreateAgentRequest(BaseModel):
    id: str
    name: str
    description: str = ""
    model: str = "claude-opus-4-5"
    system_prompt: str = ""
    config_json: dict | None = None


class UpdateAgentRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    model: Optional[str] = None
    system_prompt: Optional[str] = None
    config_json: Optional[dict] = None


class CreateConversationRequest(BaseModel):
    title: str = "New conversation"
    agent_id: str = "default"


class SendMessageRequest(BaseModel):
    content: str


class ApprovalRequest(BaseModel):
    approved: bool
