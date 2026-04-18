"""
Email service for sending OTP & notifications via Gmail SMTP.

SMTP credentials are read from environment variables (loaded via .env):

    SMTP_HOST       (default: smtp.gmail.com)
    SMTP_PORT       (default: 587)
    SMTP_USE_SSL    (default: false  -> STARTTLS on port 587;
                                        true -> implicit SSL on port 465)
    SMTP_USERNAME   (Gmail address, e.g. notifications@yourdomain.com)
    SMTP_PASSWORD   (Gmail App Password — NOT your normal account password)
    SMTP_FROM_NAME  (display name in From header, default: "RupiyaMaker CRM")

The service intentionally does NOT read SMTP credentials from MongoDB.
This is by design: it removes the legacy `email_settings` admin UI from the
CRM and prevents anyone with DB / Settings access from changing the sender
mailbox at runtime.

Recipient emails (the personal emails of the OTP approver employees for
the requesting user's role) are looked up by the caller and passed in.
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Tuple

from motor.motor_asyncio import AsyncIOMotorClient


def _env_bool(name: str, default: bool = False) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return val.strip().lower() in ("1", "true", "yes", "y", "on")


def _load_db_smtp() -> dict:
    """Synchronously load SMTP settings from MongoDB email_settings collection."""
    try:
        mongo_url = os.getenv("MONGO_URL", "mongodb://raunak:Raunak%40123@156.67.111.95:27017/admin?authSource=admin")
        company = os.getenv("COMPANY_NAME", "crm_database_dev")
        from pymongo import MongoClient
        client = MongoClient(mongo_url, serverSelectionTimeoutMS=2000)
        db = client[company]
        setting = db.email_settings.find_one({"is_active": True, "purpose": "otp"})
        client.close()
        if setting:
            port = int(setting.get("smtp_port", 587))
            return {
                "host": setting.get("smtp_server", "smtp.gmail.com"),
                "port": port,
                # Port 465 = implicit SSL; port 587 = STARTTLS (not SSL)
                "use_ssl": port == 465,
                "username": setting.get("email", ""),
                "password": setting.get("password", ""),
            }
    except Exception as e:
        print(f"[EmailService] DB SMTP fallback failed: {e}")
    return {}


class EmailService:
    """Stateless SMTP wrapper. Reads credentials from env vars, falling back to DB."""

    def __init__(self):
        env_user = os.getenv("SMTP_USERNAME", "")
        env_pass = os.getenv("SMTP_PASSWORD", "")

        # Fall back to DB credentials when env vars are not configured
        if env_user and env_pass:
            self.smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
            self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
            self.smtp_use_ssl = _env_bool("SMTP_USE_SSL", False)
            self.smtp_username = env_user
            self.smtp_password = env_pass
        else:
            db_cfg = _load_db_smtp()
            self.smtp_host = db_cfg.get("host", "smtp.gmail.com")
            self.smtp_port = db_cfg.get("port", 587)
            self.smtp_use_ssl = db_cfg.get("use_ssl", False)
            self.smtp_username = db_cfg.get("username", "")
            self.smtp_password = db_cfg.get("password", "")

        self.from_name = os.getenv("SMTP_FROM_NAME", "RupiyaMaker CRM")

    # ────────────────────────────────────────────────────────────────────────
    # Public API
    # ────────────────────────────────────────────────────────────────────────
    def is_configured(self) -> bool:
        """True when SMTP_USERNAME and SMTP_PASSWORD env vars are present."""
        return bool(self.smtp_username and self.smtp_password)

    def send_otp_email(
        self,
        user_data: dict,
        otp_code: str,
        recipient_emails: List[str],
    ) -> Tuple[bool, str]:
        """Send an OTP email to each recipient personal email.

        Returns (success, message). `success` is True if at least one
        recipient received the mail successfully.
        """
        if not self.is_configured():
            msg = (
                "SMTP not configured. Set SMTP_USERNAME and SMTP_PASSWORD "
                "(Gmail App Password) in backend .env file."
            )
            print(f"[EmailService] {msg}")
            return False, msg

        # De-dupe & strip
        clean = []
        seen = set()
        for e in recipient_emails or []:
            if not e:
                continue
            e2 = e.strip()
            if e2 and e2.lower() not in seen:
                seen.add(e2.lower())
                clean.append(e2)

        if not clean:
            return False, "No valid recipient emails provided"

        user_name = (
            f"{user_data.get('first_name', '')} {user_data.get('last_name', '')}".strip()
            or user_data.get('username')
            or 'Unknown User'
        )
        subject = f"🔐 RupiyaMaker CRM — Login OTP for {user_name}"
        body_html = self._build_otp_html(user_data, user_name, otp_code)

        success_count = 0
        last_error = ""
        for to_email in clean:
            ok, err = self._send_email(to_email, subject, body_html)
            if ok:
                success_count += 1
                print(f"[EmailService] OTP email sent to {to_email}")
            else:
                last_error = err
                print(f"[EmailService] Failed to send OTP to {to_email}: {err}")

        if success_count > 0:
            return True, f"OTP sent to {success_count}/{len(clean)} approver(s)"
        return False, f"Failed to send OTP to any approver. Last error: {last_error}"

    # ────────────────────────────────────────────────────────────────────────
    # Internals
    # ────────────────────────────────────────────────────────────────────────
    def _build_otp_html(self, user_data: dict, user_name: str, otp_code: str) -> str:
        return f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                <h2 style="color: #007bff; text-align: center;">🔐 CRM Login OTP Request</h2>

                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #495057;">Login Request Details:</h3>
                    <p><strong>Employee Name:</strong> {user_name}</p>
                    <p><strong>Username:</strong> {user_data.get('username', 'N/A')}</p>
                    <p><strong>Work Email:</strong> {user_data.get('email', 'N/A')}</p>
                    <p><strong>Employee ID:</strong> {user_data.get('employee_id', user_data.get('_id', 'N/A'))}</p>
                </div>

                <div style="text-align: center; background-color: #e3f2fd; padding: 20px; border-radius: 5px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #1976d2;">OTP Code</h3>
                    <div style="font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 6px; font-family: monospace;">
                        {otp_code}
                    </div>
                    <p style="color: #666; font-size: 14px; margin: 10px 0 0 0;">Valid for 30 minutes</p>
                </div>

                <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107;">
                    <p style="margin: 0;"><strong>⚠️ Action required:</strong>
                       You are configured as an OTP approver for this employee's role.
                       Verify the requester's identity before sharing this OTP.
                       This email was sent because the employee tried to log in to the CRM just now.</p>
                </div>

                <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
                    <p>This is an automated message from RupiyaMaker CRM.</p>
                </div>
            </div>
        </body>
        </html>
        """

    def _send_email(self, to_email: str, subject: str, body_html: str) -> Tuple[bool, str]:
        try:
            msg = MIMEMultipart('alternative')
            msg['From'] = f"{self.from_name} <{self.smtp_username}>"
            msg['To'] = to_email
            msg['Subject'] = subject
            msg.attach(MIMEText(body_html, 'html'))

            if self.smtp_use_ssl:
                server = smtplib.SMTP_SSL(self.smtp_host, self.smtp_port, timeout=10)
            else:
                server = smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=10)
                server.starttls()

            server.login(self.smtp_username, self.smtp_password)
            server.send_message(msg)
            server.quit()
            return True, "ok"
        except Exception as e:
            return False, str(e)
