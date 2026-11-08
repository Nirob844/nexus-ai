import os
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors

DOCS_DIR = os.path.abspath("demo_docs")
os.makedirs(DOCS_DIR, exist_ok=True)

# ------------------------------------------------------------------------------
# DOCUMENT 1: Billing & Subscription Policy
# ------------------------------------------------------------------------------
doc1_title = "Acme Corporation — Billing, Invoicing & Subscription Policy (2026)"
doc1_text = """ACME CORPORATION
BILLING, INVOICING & SUBSCRIPTION POLICY — FISCAL YEAR 2026

1. SUBSCRIPTION TIERS & PRICING
Acme Cloud SaaS operates under three primary customer service tiers:
• Starter Plan ($49/month or $470/year): Up to 5 team members, standard ticketing, email support.
• Professional Plan ($199/month or $1,900/year): Up to 25 team members, AI auto-classification, priority queue routing, 99.9% uptime SLA.
• Enterprise Plan ($799/month or $7,670/year): Unlimited team members, custom RAG knowledge base integration, dedicated customer success manager, 99.99% uptime guarantee, 24/7 emergency hotline.
Annual subscriptions include a 20% upfront discount compared to month-to-month billing.

2. CANCELLATION & 14-DAY REFUND POLICY
• 14-Day Money-Back Guarantee: New subscribers may cancel their subscription within fourteen (14) calendar days of initial account creation for a full 100% refund without penalty.
• Mid-Cycle Cancellations: Cancellations initiated after the initial 14-day window will remain active through the end of the current paid billing cycle. No prorated cash refunds are granted for partial months, but accounts retain full system access until the period ends.
• Service Credit Exceptions: In cases where documented service downtime exceeds our committed SLA (>0.1% downtime in a billing month), customers are eligible for a 15% SLA billing credit applied to their subsequent invoice.

3. INVOICE DISPUTES & PAYMENT GRACE PERIOD
• Invoices are automatically issued on the first day of each billing cycle to the billing email on file.
• Grace Period: If an automated credit card charge fails, Acme provides a seven (7) day payment grace period during which three retry attempts are executed.
• Account Suspension: If an invoice remains unsettled after the 7-day grace window, account access will be temporarily locked to read-only status. Data is preserved for sixty (60) days prior to deletion.
• Dispute Filing: All invoice discrepancies or billing queries must be formally submitted via support ticket within thirty (30) days of invoice generation.
"""

# ------------------------------------------------------------------------------
# DOCUMENT 2: Cloud Infrastructure & Incident Runbook
# ------------------------------------------------------------------------------
doc2_title = "Acme Cloud Infrastructure, Security & Incident Response Runbook"
doc2_text = """ACME CLOUD INFRASTRUCTURE & INCIDENT MANAGEMENT RUNBOOK

1. INCIDENT SEVERITY CLASSIFICATION & SLA RESPONSE TARGETS
Engineering and technical support classify production events into four standard tiers:
• P1 (Critical - System Outage): Core SaaS platform unreachable or major data integrity failure. Response SLA: 15 minutes. Updates provided every 30 minutes. Lead: Incident Commander on-call.
• P2 (Major - Degraded Functionality): Primary features (such as AI background processing or WebSockets) impaired, but core app operational. Response SLA: 1 hour. Updates provided every 2 hours.
• P3 (Moderate - Minor Impairment): Non-critical bugs, cosmetic UI anomalies, or individual slow queries. Response SLA: 8 business hours.
• P4 (Low - Feature Inquiries): General technical questions or configuration guidance. Response SLA: 24 business hours.

2. SCHEDULED MAINTENANCE WINDOWS & BACKUPS
• Standard Maintenance Window: Weekly routine infrastructure maintenance is strictly scheduled on Sundays between 02:00 UTC and 04:00 UTC. Customers are notified at least 72 hours in advance via dashboard banner.
• Automated Database Backups: PostgreSQL point-in-time snapshots are taken hourly and stored across two geographically distinct cloud regions with 256-bit AES encryption. Hourly snapshots are retained for 30 days; daily rollups are archived for 1 year.

3. API RATE LIMITS & SECURITY COMPLIANCE
• Standard Tier API Limit: 1,000 requests per minute per tenant API key. Exceeding this triggers HTTP 429 (Too Many Requests) with a Retry-After header.
• Enterprise Tier API Limit: 5,000 requests per minute with dedicated bursting pool up to 10,000 req/min.
• Multi-Factor Authentication (MFA): MFA is mandatory for all user accounts assigned ORG_OWNER or ORG_ADMIN roles. Single Sign-On (SSO) via SAML 2.0 / Okta is supported on Enterprise tiers.
"""

# ------------------------------------------------------------------------------
# DOCUMENT 3: Employee Handbook, Leave & Remote Work
# ------------------------------------------------------------------------------
doc3_title = "Acme Corporation — Employee Benefits, Leave Policy & Remote Work Guidelines"
doc3_text = """ACME CORPORATION
INTERNAL EMPLOYEE HANDBOOK: BENEFITS, LEAVE & REMOTE GUIDELINES (2026)

1. ANNUAL LEAVE & TIME-OFF ENTITLEMENT
• Paid Annual Leave: Full-time permanent employees accrue twenty-five (25) paid vacation days per calendar year, accrued evenly on a monthly basis (2.08 days per month).
• Sick Leave: Up to ten (10) paid sick days per year are available. A certified physician's medical note is required only for consecutive sick absences exceeding three (3) working days.
• Annual Leave Rollover: Employees may roll over a maximum of five (5) unused vacation days into the following year. Rolled-over days must be utilized before March 31st (end of Q1).
• Bereavement & Compassionate Leave: Employees are entitled to up to five (5) paid business days for immediate family bereavement.

2. REMOTE WORK & HOME OFFICE EQUIPMENT STIPEND
• Flexible Work Model: Acme embraces a hybrid and remote-first workplace. Team members may work fully remotely with manager alignment.
• Home Office Setup Allowance: Every new full-time employee receives a one-time reimbursement stipend of up to $1,000 USD to purchase ergonomic desk equipment, monitors, chairs, or peripherals. Expense receipts must be submitted via HR portal within 60 days of start date.
• Monthly Internet Allowance: Remote employees receive a monthly tax-free $50 USD stipend added to their salary for high-speed broadband connection.

3. CORE COLLABORATION HOURS & WORKING NORMS
• To facilitate asynchronous collaboration across timezones, all departments observe Core Working Hours between 10:00 AM and 3:00 PM in their respective local timezones.
• All team members are expected to be reachable via Slack/Teams during core hours unless on pre-scheduled PTO or focus blocks.
"""

def create_pdf(filename, title, content):
    filepath = os.path.join(DOCS_DIR, filename)
    doc = SimpleDocTemplate(filepath, pagesize=letter, leftMargin=50, rightMargin=50, topMargin=50, bottomMargin=50)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#0f172a'),
        spaceAfter=15,
    )
    
    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#334155'),
        spaceAfter=8,
    )

    story = [
        Paragraph(title, title_style),
        Spacer(1, 15),
    ]

    for para in content.strip().split("\n\n"):
        story.append(Paragraph(para.replace("\n", "<br/>"), body_style))
        story.append(Spacer(1, 6))

    doc.build(story)
    print(f"✅ Generated PDF: {filepath}")

def save_text(filename, content):
    filepath = os.path.join(DOCS_DIR, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"✅ Generated TXT: {filepath}")

# Generate all 3 PDF and TXT files
create_pdf("01_Acme_Billing_and_Subscription_Policy_2026.pdf", doc1_title, doc1_text)
save_text("01_Acme_Billing_and_Subscription_Policy_2026.txt", doc1_text)

create_pdf("02_Acme_Cloud_Infrastructure_and_Security_Runbook.pdf", doc2_title, doc2_text)
save_text("02_Acme_Cloud_Infrastructure_and_Security_Runbook.txt", doc2_text)

create_pdf("03_Acme_Employee_Leave_and_Remote_Work_Guidelines.pdf", doc3_title, doc3_text)
save_text("03_Acme_Employee_Leave_and_Remote_Work_Guidelines.txt", doc3_text)

print("\n🚀 All demo documents generated in directory: demo_docs/")
