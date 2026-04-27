"""이메일 발송 서비스 — SMTP"""

import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders

from ..config import settings


async def send_email(
    to: str | list[str],
    subject: str,
    body: str,
    html: str | None = None,
    attachments: list[tuple[str, bytes]] | None = None,
    cc: str | list[str] | None = None,
):
    """이메일 발송"""
    msg = MIMEMultipart("mixed")
    msg["From"] = settings.smtp_user
    msg["To"] = to if isinstance(to, str) else ", ".join(to)
    msg["Subject"] = subject
    if cc:
        msg["Cc"] = cc if isinstance(cc, str) else ", ".join(cc)

    # 본문
    if html:
        text_part = MIMEMultipart("alternative")
        text_part.attach(MIMEText(body, "plain", "utf-8"))
        text_part.attach(MIMEText(html, "html", "utf-8"))
        msg.attach(text_part)
    else:
        msg.attach(MIMEText(body, "plain", "utf-8"))

    # 첨부파일
    if attachments:
        for filename, data in attachments:
            part = MIMEBase("application", "octet-stream")
            part.set_payload(data)
            encoders.encode_base64(part)
            part.add_header("Content-Disposition", f"attachment; filename={filename}")
            msg.attach(part)

    # SMTP 발송
    recipients = [to] if isinstance(to, str) else list(to)
    if cc:
        recipients += [cc] if isinstance(cc, str) else list(cc)

    await aiosmtplib.send(
        msg,
        hostname=settings.smtp_host,
        port=settings.smtp_port,
        start_tls=True,
        username=settings.smtp_user,
        password=settings.smtp_pass,
        recipients=recipients,
    )
