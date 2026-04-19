"""
Email service for sending OTP via Gmail SMTP.

Credentials: env vars first (SMTP_USERNAME, SMTP_PASSWORD), then DB fallback
(email_settings collection). Port 587 = STARTTLS, port 465 = implicit SSL.
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Tuple


def _load_db_smtp() -> dict:
    """Synchronously load SMTP settings from MongoDB email_settings collection."""
    try:
        mongo_url = os.getenv(
            "MONGO_URL",
            "mongodb://raunak:Raunak%40123@156.67.111.95:27017/admin?authSource=admin"
        )
        company = os.getenv("COMPANY_NAME", "crm_database")
        from pymongo import MongoClient
        client = MongoClient(mongo_url, serverSelectionTimeoutMS=2000)
        db = client[company]
        setting = db.email_settings.find_one({"is_active": True, "purpose": "otp"})
        if not setting:
            setting = db.email_settings.find_one({"is_active": True})
        client.close()
        if setting:
            port = int(setting.get("smtp_port", 587))
            return {
                "host": setting.get("smtp_server", "smtp.gmail.com"),
                "port": port,
                "use_ssl": port == 465,   # 465=SSL, 587=STARTTLS
                "username": setting.get("email", ""),
                "password": setting.get("password", ""),
            }
    except Exception as e:
        print(f"[EmailService] DB SMTP fallback failed: {e}")
    return {}


class EmailService:
    def __init__(self):
        env_user = os.getenv("SMTP_USERNAME", "")
        env_pass = os.getenv("SMTP_PASSWORD", "")

        if env_user and env_pass:
            self.smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
            self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
            self.smtp_use_ssl = self.smtp_port == 465
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

    def is_configured(self) -> bool:
        return bool(self.smtp_username and self.smtp_password)

    def send_otp_to_approvers(self, user_data: dict, otp_code: str, approver_emails: List[str]) -> bool:
        """Send OTP to approver personal emails. Returns True if >=1 sent."""
        success, _ = self.send_otp_email(user_data, otp_code, approver_emails)
        return success

    def send_otp_email(self, user_data: dict, otp_code: str, recipient_emails: List[str]) -> Tuple[bool, str]:
        if not self.is_configured():
            msg = ("SMTP not configured. Set SMTP_USERNAME and SMTP_PASSWORD "
                   "(Gmail App Password) in ecosystem.config.js env section "
                   "OR update the email_settings record in MongoDB.")
            print(f"[EmailService] {msg}")
            return False, msg

        clean = []
        seen: set = set()
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
            or user_data.get("username") or "Unknown User"
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
        return False, f"Failed to send to any approver. Last error: {last_error}"

    def _build_otp_html(self, user_data: dict, user_name: str, otp_code: str) -> str:
        return f"""
        <html><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width:600px;margin:0 auto;padding:20px;border:1px solid #ddd;border-radius:10px;">
                <h2 style="color:#007bff;text-align:center;">🔐 CRM Login OTP Request</h2>
                <div style="background:#f8f9fa;padding:15px;border-radius:5px;margin:20px 0;">
                    <h3 style="margin-top:0;color:#495057;">Login Request Details:</h3>
                    <p><strong>Employee Name:</strong> {user_name}</p>
                    <p><strong>Username:</strong> {user_data.get('username', 'N/A')}</p>
                    <p><strong>Work Email:</strong> {user_data.get('email', 'N/A')}</p>
                    <p><strong>Employee ID:</strong> {user_data.get('employee_id', str(user_data.get('_id', 'N/A')))}</p>
                </div>
                <div style="text-align:center;background:#e3f2fd;padding:20px;border-radius:5px;margin:20px 0;">
                    <h3 style="margin-top:0;color:#1976d2;">OTP Code</h3>
                    <div style="font-size:32px;font-weight:bold;color:#007bff;letter-spacing:6px;font-family:monospace;">{otp_code}</div>
                    <p style="color:#666;font-size:14px;margin:10px 0 0 0;">Valid for 30 minutes</p>
                </div>
                <div style="background:#fff3cd;padding:15px;border-radius:5px;border-left:4px solid #ffc107;">
                    <p style="margin:0;"><strong>⚠️ Action required:</strong>
                    You are configured as an OTP approver. Verify the requester's identity before sharing this OTP.</p>
                </div>
                <div style="text-align:center;margin-top:20px;padding-top:20px;border-top:1px solid #ddd;color:#666;font-size:12px;">
                    <p>Automated message from RupiyaMaker CRM</p>
                </div>
            </div>
        </body></html>
        """

    def _send_email(self, to_email: str, subject: str, body_html: str) -> Tuple[bool, str]:
        try:
            msg = MIMEMultipart("alternative")
            msg["From"] = f"{self.from_name} <{self.smtp_username}>"
            msg["To"] = to_email
            msg["Subject"] = subject
            msg.attach(MIMEText(body_html, "html"))

            if self.smtp_use_ssl:
                server = smtplib.SMTP_SSL(self.smtp_host, self.smtp_port)
            else:
                server = smtplib.SMTP(self.smtp_host, self.smtp_port)
                server.ehlo()
                server.starttls()
                server.ehlo()

            server.login(self.smtp_username, self.smtp_password)
            server.sendmail(self.smtp_username, to_email, msg.as_string())
            server.quit()
            return True, "OK"
        except Exception as e:
            return False, str(e)
