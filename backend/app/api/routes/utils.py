from fastapi import APIRouter, Depends, Request, HTTPException
import subprocess
import hmac
import hashlib
import os

from pydantic.networks import EmailStr

from app.api.deps import get_current_active_superuser
from app.models import Message
from app.utils import generate_test_email, send_email
from app.core.config import settings

router = APIRouter(prefix="/utils", tags=["utils"])

# Get the secret from the .env file
GITHUB_WEBHOOK_SECRET = settings.GITHUB_WEBHOOK_SECRET

@router.post(
    "/test-email/",
    dependencies=[Depends(get_current_active_superuser)],
    status_code=201,
)
async def test_email(email_to: EmailStr) -> Message:
    """
    Test emails.
    """
    email_data = generate_test_email(email_to=email_to)
    await send_email(
        email_to=email_to,
        subject=email_data.subject,
        html_content=email_data.html_content,
    )
    return Message(message="Test email sent")

@router.post("/webhook-pull-a8d9f")  # <-- This is your secret URL
async def webhook_pull(request: Request):
    """
    Receives a webhook from GitHub to pull changes.
    Verifies the signature.
    """
    if not GITHUB_WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="Webhook secret not configured")

    # Verify the signature
    signature = request.headers.get('X-Hub-Signature-256')
    if not signature:
        raise HTTPException(status_code=403, detail="Signature missing")

    body = await request.body()

    # Calculate expected signature
    expected_signature = "sha256=" + hmac.new(
        key=GITHUB_WEBHOOK_SECRET.encode('utf-8'),
        msg=body,
        digestmod=hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(expected_signature, signature):
        raise HTTPException(status_code=403, detail="Invalid signature")

    # If signature is valid, run the script in the background
    print("Valid signature. Initiating pull script...")
    subprocess.Popen(["/home/webapp/git_pull.sh"])
    return {"message": "Pull script initiated"}

@router.get("/health-check/")
async def health_check() -> bool:
    return True
