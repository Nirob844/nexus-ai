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

class TicketMessageInput(BaseModel):
    sender_type: str
    sender_name: Optional[str] = None
    content: str

class TicketSummarizeRequest(BaseModel):
    ticket_id: str
    subject: str
    messages: List[TicketMessageInput]

class TicketSummarizeResponse(BaseModel):
    summary: str
    key_points: List[str]
    suggested_next_steps: List[str]
    handover_notes: str

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

@router.post("/summarize", response_model=TicketSummarizeResponse)
async def summarize_ticket(req: TicketSummarizeRequest):
    """
    Summarize long ticket message threads and generate shift handover notes.
    """
    total_messages = len(req.messages)
    customer_messages = [m for m in req.messages if m.sender_type.upper() == "CUSTOMER"]
    agent_messages = [m for m in req.messages if m.sender_type.upper() in ["AGENT", "AI"]]

    first_issue = customer_messages[0].content if customer_messages else "Issue details"
    latest_update = req.messages[-1].content if req.messages else "No updates"

    summary = (
        f"Ticket regarding \"{req.subject}\" has {total_messages} messages exchanged. "
        f"Customer initially reported: \"{first_issue[:150]}...\". "
        f"Latest interaction indicates: \"{latest_update[:150]}...\"."
    )

    key_points = [
        f"Core Subject: {req.subject}",
        f"Initial Inquiry: {first_issue[:120]}",
        f"Total conversation exchanges: {total_messages} ({len(customer_messages)} customer, {len(agent_messages)} agent)",
    ]

    suggested_next_steps = [
        "Verify if customer has confirmed resolution",
        "Update ticket state to Pending Customer or Resolved if verified",
    ]

    handover_notes = (
        f"HANDOVER BRIEF [Ticket #{req.ticket_id}]:\n"
        f"Customer reported '{req.subject}'. "
        f"Agent reviewed internal documentation and provided guidance. "
        f"Waiting for final confirmation or resolution closure."
    )

    return {
        "summary": summary,
        "key_points": key_points,
        "suggested_next_steps": suggested_next_steps,
        "handover_notes": handover_notes,
    }

