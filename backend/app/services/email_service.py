import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.database.EmailSettings import EmailSettingsDB
from app.database.AdminEmails import AdminEmailsDB

class EmailService:
    def __init__(self):
        self.email_settings_db = EmailSettingsDB()
        self.admin_emails_db = AdminEmailsDB()

    def send_otp_email(self, user_data, otp_code):
        """Send OTP email to admin emails"""
        try:
            # Get active email settings for OTP
            email_setting = self.email_settings_db.get_active_otp_email()
            if not email_setting:
                print("No active email setting found for OTP")
                return False

            # Get all active admin emails that should receive OTP
            admin_emails = self.admin_emails_db.get_active_otp_admin_emails()
            if not admin_emails:
                print("No admin emails configured for OTP reception")
                return False

            # Create email content
            user_name = f"{user_data.get('first_name', '')} {user_data.get('last_name', '')}".strip()
            if not user_name:
                user_name = user_data.get('username', 'Unknown User')
            
            subject = f"🔐 OTP Request - {user_name} Login"
            
            body = f"""
            <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                    <h2 style="color: #007bff; text-align: center;">🔐 Employee Login OTP Request</h2>
                    
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #495057;">Employee Details:</h3>
                        <p><strong>Name:</strong> {user_name}</p>
                        <p><strong>Username:</strong> {user_data.get('username', 'N/A')}</p>
                        <p><strong>Email:</strong> {user_data.get('email', 'N/A')}</p>
                        <p><strong>Employee ID:</strong> {user_data.get('employee_id', user_data.get('_id', 'N/A'))}</p>
                        <p><strong>Department:</strong> {user_data.get('department_name', 'N/A')}</p>
                    </div>
                    
                    <div style="text-align: center; background-color: #e3f2fd; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #1976d2;">OTP Code:</h3>
                        <div style="font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 4px; font-family: monospace;">
                            {otp_code}
                        </div>
                        <p style="color: #666; font-size: 14px; margin: 10px 0 0 0;">Valid for 30 minutes</p>
                    </div>
                    
                    <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107;">
                        <p><strong>⚠️ Important:</strong> This OTP is required for employee login verification. Please provide this code to the employee to complete their login process.</p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
                        <p>This is an automated message from Rupiya Maker CRM System</p>
                        <p>Login Request Time: {user_data.get('login_time', 'N/A')}</p>
                    </div>
                </div>
            </body>
            </html>
            """

            # Send email to all admin emails
            success_count = 0
            
            for admin_email in admin_emails:
                success = self._send_email(
                    email_setting,
                    admin_email['email'],
                    subject,
                    body
                )
                
                if success:
                    success_count += 1
                    print(f"OTP email sent successfully to {admin_email['email']} ({admin_email.get('name', 'Admin')})")
                else:
                    print(f"Failed to send OTP email to {admin_email['email']}")

            if success_count > 0:
                print(f"OTP email sent successfully to {success_count}/{len(admin_emails)} admin(s)")
                return True
            else:
                print("Failed to send OTP email to any admin")
                return False

        except Exception as e:
            print(f"Error sending OTP email: {e}")
            return False

    def _send_email(self, email_setting, to_email, subject, body):
        """Send individual email"""
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['From'] = email_setting['email']
            msg['To'] = to_email
            msg['Subject'] = subject

            # Attach HTML body
            html_part = MIMEText(body, 'html')
            msg.attach(html_part)

            # Create SMTP session
            if email_setting['use_ssl']:
                server = smtplib.SMTP_SSL(email_setting['smtp_server'], email_setting['smtp_port'])
            else:
                server = smtplib.SMTP(email_setting['smtp_server'], email_setting['smtp_port'])
                server.starttls()  # Enable security

            # Login and send email
            server.login(email_setting['email'], email_setting['password'])
            server.send_message(msg)
            server.quit()

            return True

        except Exception as e:
            print(f"Error sending email to {to_email}: {e}")
            return False
