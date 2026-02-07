from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import date
import logging

from app.database import SessionLocal
from app.services.news_crawler import NewsCrawler
from app.services.newsdesk_ai import NewsDeskAI
from app.models.newsdesk import NewsDesk

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def generate_newsdesk_job():
    """뉴스데스크 자동 생성 작업"""
    logger.info("Starting scheduled newsdesk generation...")

    db = SessionLocal()
    newsdesk = None
    try:
        target_date = date.today()

        # 이미 생성된 경우 스킵
        existing = db.query(NewsDesk).filter(
            NewsDesk.publish_date == target_date,
            NewsDesk.status == "ready"
        ).first()

        if existing:
            logger.info(f"NewsDesk for {target_date} already exists, skipping")
            return

        # 상태 업데이트
        newsdesk = db.query(NewsDesk).filter(
            NewsDesk.publish_date == target_date
        ).first()

        if not newsdesk:
            newsdesk = NewsDesk(
                publish_date=target_date,
                status="generating"
            )
            db.add(newsdesk)
            db.commit()
            db.refresh(newsdesk)
        else:
            newsdesk.status = "generating"
            db.commit()

        # 1. 뉴스 크롤링
        crawler = NewsCrawler(db)
        collected = crawler.collect_all(target_date)
        logger.info(f"Collected {collected} news articles")

        # 2. AI 분석
        raw_news = crawler.get_raw_news(target_date)
        if raw_news:
            ai_service = NewsDeskAI(db)
            content = ai_service.generate_newsdesk(target_date, raw_news)
            ai_service.save_newsdesk(target_date, content, len(raw_news))
            logger.info(f"NewsDesk generated successfully for {target_date}")
        else:
            newsdesk.status = "failed"
            newsdesk.error_message = "No news collected"
            db.commit()
            logger.warning("No news collected for newsdesk")

    except Exception as e:
        logger.error(f"Scheduled newsdesk generation failed: {e}")
        if newsdesk:
            newsdesk.status = "failed"
            newsdesk.error_message = str(e)
            db.commit()
    finally:
        db.close()


def init_scheduler():
    """스케줄러 초기화"""
    # 오전 5시 30분
    scheduler.add_job(
        generate_newsdesk_job,
        CronTrigger(hour=5, minute=30),
        id="newsdesk_morning",
        replace_existing=True
    )

    # 오후 5시 30분
    scheduler.add_job(
        generate_newsdesk_job,
        CronTrigger(hour=17, minute=30),
        id="newsdesk_afternoon",
        replace_existing=True
    )

    scheduler.start()
    logger.info("NewsDesk scheduler initialized (05:30, 17:30)")


def shutdown_scheduler():
    """스케줄러 종료"""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("NewsDesk scheduler shutdown")
