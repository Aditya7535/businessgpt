from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from app.core.database import get_db
from app.modules.orchestrator.graph import app_graph
from app.core.auth import require_role
from app.models.user import User
from app.models.chat_message import ChatMessage

router = APIRouter()

class ChatRequest(BaseModel):
    session_id: str = "default"
    message: str

class ChatResponse(BaseModel):
    response: str
    module_used: str
    sources: List[str]
    confidence: float
    session_id: str = "default"

class ChatMessageItem(BaseModel):
    id: str
    role: str
    text: str
    module: Optional[str] = "SQL"
    sources: Optional[List[str]] = []
    timestamp: str

class ChatSessionItem(BaseModel):
    session_id: str
    title: str
    last_message: str
    last_active: str
    message_count: int

@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["OWNER", "MANAGER", "EMPLOYEE"]))
):
    session_id = request.session_id.strip() if request.session_id else "default"
    
    # 1. Save user query to database
    try:
        user_msg = ChatMessage(
            user_id=current_user.id,
            session_id=session_id,
            role="user",
            content=request.message,
            module=None,
            sources=None
        )
        db.add(user_msg)
        db.commit()
        db.refresh(user_msg)
    except Exception as e:
        db.rollback()
        # Non-fatal if DB insert fails; proceed with response
        print(f"[Chat History Error] Could not save user message: {e}")

    try:
        # 2. Run LangGraph Orchestrator
        final_state = app_graph.invoke({"query": request.message})
        
        reply_text = final_state.get("final_response", "I could not generate an answer.")
        module_used = final_state.get("module_used", "general")
        sources = ["postgresql_db"] if module_used in ["sql", "general"] else []
        confidence = final_state.get("confidence", 0.95)

        # 3. Save assistant response to database
        try:
            bot_msg = ChatMessage(
                user_id=current_user.id,
                session_id=session_id,
                role="assistant",
                content=reply_text,
                module=module_used.upper(),
                sources=sources
            )
            db.add(bot_msg)
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"[Chat History Error] Could not save bot response: {e}")

        return ChatResponse(
            response=reply_text,
            module_used=module_used,
            sources=sources,
            confidence=confidence,
            session_id=session_id
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error executing orchestrator: {str(e)}")

@router.get("/chat/history", response_model=List[ChatMessageItem])
def get_chat_history(
    session_id: str = "default",
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["OWNER", "MANAGER", "EMPLOYEE"]))
):
    """Retrieve full chat history for a session."""
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .limit(limit)
        .all()
    )
    return [
        ChatMessageItem(
            id=str(m.id),
            role=m.role,
            text=m.content,
            module=m.module or "SQL",
            sources=m.sources or [],
            timestamp=m.created_at.strftime("%I:%M %p") if m.created_at else ""
        )
        for m in messages
    ]

@router.get("/chat/sessions", response_model=List[ChatSessionItem])
def get_chat_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["OWNER", "MANAGER", "EMPLOYEE"]))
):
    """Retrieve list of distinct chat sessions with recent activity."""
    # Group by session_id
    stats = (
        db.query(
            ChatMessage.session_id,
            func.max(ChatMessage.created_at).label("last_active"),
            func.count(ChatMessage.id).label("cnt")
        )
        .group_by(ChatMessage.session_id)
        .order_by(desc("last_active"))
        .limit(20)
        .all()
    )
    
    results = []
    for s_id, last_active, cnt in stats:
        # Get first user message as session title
        first_user_msg = (
            db.query(ChatMessage.content)
            .filter(ChatMessage.session_id == s_id, ChatMessage.role == "user")
            .order_by(ChatMessage.created_at.asc())
            .first()
        )
        # Get latest message
        last_msg = (
            db.query(ChatMessage.content)
            .filter(ChatMessage.session_id == s_id)
            .order_by(ChatMessage.created_at.desc())
            .first()
        )
        
        title = first_user_msg[0][:35] + ("..." if len(first_user_msg[0]) > 35 else "") if first_user_msg else f"Chat ({s_id})"
        preview = last_msg[0][:60] + ("..." if len(last_msg[0]) > 60 else "") if last_msg else ""
        
        results.append(
            ChatSessionItem(
                session_id=s_id,
                title=title,
                last_message=preview,
                last_active=last_active.strftime("%b %d, %I:%M %p") if last_active else "",
                message_count=cnt
            )
        )
    return results

@router.delete("/chat/history")
def clear_chat_history(
    session_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["OWNER", "MANAGER"]))
):
    """Clear chat messages for a specific session or all sessions."""
    q = db.query(ChatMessage)
    if session_id:
        q = q.filter(ChatMessage.session_id == session_id)
    deleted_count = q.delete(synchronize_session=False)
    db.commit()
    return {"status": "success", "deleted_count": deleted_count}
