from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from app.modules.orchestrator.graph import app_graph

router = APIRouter()

class ChatRequest(BaseModel):
    session_id: str = "default"
    message: str

class ChatResponse(BaseModel):
    response: str
    module_used: str
    sources: List[str]
    confidence: float

# In-memory conversation history (stores last 10 messages per session)
chat_history = {}

@router.post("/", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    # Initialize history for new sessions
    if request.session_id not in chat_history:
        chat_history[request.session_id] = []
        
    history = chat_history[request.session_id]
    
    # In a full production version, we would inject `history` into the LangGraph state.
    # For Phase 2 MVP, we route the standalone user query.
    
    try:
        # Run LangGraph Orchestrator
        final_state = app_graph.invoke({"query": request.message})
        
        # Save to history (10 exchanges = 20 messages)
        history.append({"role": "user", "content": request.message})
        history.append({"role": "assistant", "content": final_state.get("final_response", "")})
        
        if len(history) > 20: 
            chat_history[request.session_id] = history[-20:]
            
        return ChatResponse(
            response=final_state.get("final_response", "I could not generate an answer."),
            module_used=final_state.get("module_used", "general"),
            sources=["chromadb_knowledge_base"] if final_state.get("module_used") == "rag" else ["postgresql_db"] if final_state.get("module_used") == "sql" else [],
            confidence=final_state.get("confidence", 0.95)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error executing orchestrator: {str(e)}")
