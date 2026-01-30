import smtplib
import random
import string
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session

from app.config import settings
from app.models.verification import EmailVerification


class EmailService:
    def __init__(self, db: Session):
        self.db = db

    def generate_code(self) -> str:
        """6자리 인증 코드 생성"""
        return ''.join(random.choices(string.digits, k=6))

    def create_verification(self, email: str) -> str:
        """인증 코드 생성 및 저장"""
        # 기존 미인증 코드 삭제
        self.db.query(EmailVerification).filter(
            EmailVerification.email == email,
            EmailVerification.is_verified == False
        ).delete()
        self.db.commit()

        code = self.generate_code()
        verification = EmailVerification(
            email=email,
            code=code,
            expires_at=datetime.utcnow() + timedelta(minutes=10)  # 10분 유효
        )
        self.db.add(verification)
        self.db.commit()

        return code

    def verify_code(self, email: str, code: str) -> bool:
        """인증 코드 확인"""
        verification = self.db.query(EmailVerification).filter(
            EmailVerification.email == email,
            EmailVerification.code == code,
            EmailVerification.is_verified == False
        ).first()

        if not verification:
            return False

        # 만료 확인
        if datetime.utcnow() > verification.expires_at.replace(tzinfo=None):
            return False

        # 인증 완료 처리
        verification.is_verified = True
        self.db.commit()

        return True

    def is_email_verified(self, email: str) -> bool:
        """이메일이 인증되었는지 확인"""
        verification = self.db.query(EmailVerification).filter(
            EmailVerification.email == email,
            EmailVerification.is_verified == True
        ).first()
        return verification is not None

    def send_verification_email(self, email: str, code: str) -> bool:
        """인증 코드 이메일 발송"""
        if not settings.smtp_user or not settings.smtp_password:
            # SMTP 설정이 없으면 콘솔에 출력 (개발용)
            print(f"[DEV] 인증 코드 발송: {email} -> {code}")
            return True

        try:
            msg = MIMEMultipart()
            msg['From'] = settings.smtp_from_email or settings.smtp_user
            msg['To'] = email
            msg['Subject'] = '[펀드팀 메신저] 이메일 인증 코드'

            body = f"""
안녕하세요,

펀드팀 메신저 회원가입을 위한 인증 코드입니다.

인증 코드: {code}

이 코드는 10분간 유효합니다.

감사합니다.
펀드팀 메신저
            """

            msg.attach(MIMEText(body, 'plain', 'utf-8'))

            with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
                server.starttls()
                server.login(settings.smtp_user, settings.smtp_password)
                server.send_message(msg)

            return True
        except Exception as e:
            print(f"이메일 발송 실패: {e}")
            return False
