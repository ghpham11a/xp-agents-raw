from pydantic import BaseModel

class CreateConversationRequest(BaseModel):
    title: str = "New conversation"

class SendMessageRequest(BaseModel):
    content: str

class ApprovalRequest(BaseModel):
    approved: bool