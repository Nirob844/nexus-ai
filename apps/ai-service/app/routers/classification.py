import re
from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from app.services.rag_engine import rag_engine

router = APIRouter(prefix="/api/v1/ai", tags=["Ticket AI Intelligence"])

class TicketClassifyRequest(BaseModel):
    subject: str
    description: str
    customer_name: Optional[str] = "Customer"

class TicketClassifyResponse(BaseModel):
    category: str
    intent: str
    sentiment: str
    urgency_score: int
    key_entities: List[str]
    summary: str

class TicketSuggestRequest(BaseModel):
    organization_id: str
    subject: str
    description: str
    customer_name: Optional[str] = "Customer"

class TicketSuggestResponse(BaseModel):
    suggested_reply: str
    action_type: Optional[str] = None
    action_payload: Optional[Dict[str, Any]] = None
    confidence: float
    grounded_citations: List[Dict[str, Any]] = []

@router.post("/classify", response_model=TicketClassifyResponse)
async def classify_ticket(req: TicketClassifyRequest):
    """
    Classify support ticket category, customer intent, sentiment and urgency.
    """
    text = f"{req.subject} {req.description}".lower()

    # Urgency & Sentiment detection
    is_urgent = bool(re.search(r"\b(urgent|critical|broken|cannot access|down|emergency|fatal|blocked)\b", text))
    is_frustrated = bool(re.search(r"\b(angry|worst|terrible|unacceptable|cancel|money back|refund|lawsuit|frustrated)\b", text))

    if is_frustrated:
        sentiment = "FRUSTRATED"
        urgency = 9
    elif is_urgent:
        sentiment = "NEGATIVE"
        urgency = 8
    elif re.search(r"\b(thank|great|solved|appreciate|helpful)\b", text):
        sentiment = "POSITIVE"
        urgency = 2
    else:
        sentiment = "NEUTRAL"
        urgency = 5

    # Category classification
    if re.search(r"\b(billing|invoice|charge|refund|payment|subscription|plan|upgrade|price)\b", text):
        category = "Billing & Subscriptions"
        intent = "Customer inquiry regarding payments, plans or billing invoices"
    elif re.search(r"\b(bug|error|crash|failure|sync|exception|500|404|api)\b", text):
        category = "Technical & Infrastructure"
        intent = "Report of technical malfunction or system error"
    elif re.search(r"\b(password|login|auth|account|2fa|sso|security)\b", text):
        category = "Account & Security"
        intent = "Assistance with user credentials, access or authentication"
    else:
        category = "General Support"
        intent = "General product question or customer assistance"

    # Entity extraction
    entities = []
    if "plan" in text or "subscription" in text:
        entities.append("Subscription")
    if "database" in text or "api" in text or "sync" in text:
        entities.append("Infrastructure")
    if "invoice" in text or "refund" in text:
        entities.append("Payment")

    summary = f"Customer '{req.customer_name}' submitted a {category} ticket regarding: '{req.subject}'."

    return {
        "category": category,
        "intent": intent,
        "sentiment": sentiment,
        "urgency_score": urgency,
        "key_entities": entities,
        "summary": summary,
    }

@router.post("/suggest", response_model=TicketSuggestResponse)
async def suggest_ticket_reply(req: TicketSuggestRequest):
    """
    Generate knowledge-grounded reply draft and suggested action recommendations.
    """
    # 1. Search knowledge base for relevant context
    rag_result = await rag_engine.answer_question(
        organization_id=req.organization_id,
        question=f"{req.subject}. {req.description}",
        top_k=3,
    )

    citations = rag_result.get("citations", [])
    has_relevant_knowledge = len(citations) > 0 and citations[0]["similarity"] > 0.35

    if has_relevant_knowledge:
        suggested_reply = (
            f"Hello {req.customer_name},\n\n"
            f"Thank you for contacting our support team.\n\n"
            f"Regarding your query about \"{req.subject}\", our internal documentation specifies:\n\n"
            f"{rag_result['answer']}\n\n"
            f"Please let us know if this resolves your issue or if you need further assistance.\n\n"
            f"Best regards,\nSupport Team"
        )
        action_type = "PROVIDE_KNOWLEDGE_ARTICLE"
        action_payload = {"referencedDocument": citations[0]["documentTitle"]}
        confidence = 0.92
    else:
        suggested_reply = (
            f"Hello {req.customer_name},\n\n"
            f"Thank you for reaching out to us. We have received your query regarding \"{req.subject}\". "
            f"Our specialized engineering and support team is actively investigating this matter, and we will update you as soon as possible.\n\n"
            f"Best regards,\nSupport Team"
        )
        action_type = "ACCOUNT_DIAGNOSTICS_RUN"
        action_payload = {"requiresManualReview": True}
        confidence = 0.85

    return {
        "suggested_reply": suggested_reply,
        "action_type": action_type,
        "action_payload": action_payload,
        "confidence": confidence,
        "grounded_citations": citations,
    }
