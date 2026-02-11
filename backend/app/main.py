from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import json

from app.config import settings
from app.database import get_db, engine, Base
from app.api import api_router
from app.websocket import manager
from app.websocket.handlers import handle_websocket_message
from app.utils.security import decode_token
from app.services.scheduler import init_scheduler, shutdown_scheduler
from app.services.stock_search_service import stock_search_service

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Fund Team Messenger API",
    description="API for managing fund team trading decisions",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost",
        "http://localhost:5173",
        "http://localhost:3000",
        "https://fundmessage.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...)
):
    # Verify token
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        await websocket.close(code=4001)
        return

    user_id = int(payload.get("sub"))

    # Connect
    await manager.connect(websocket, user_id)

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            # Get DB session for this message
            db = next(get_db())
            try:
                await handle_websocket_message(websocket, message, user_id, manager, db)
            finally:
                db.close()

    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
    except Exception as e:
        manager.disconnect(websocket, user_id)


# Startup event (시드 계정 생성 제거됨 - 첫 가입자가 자동으로 팀장이 됨)
def _seed_newsdesk_data():
    """뉴스데스크 시드 데이터 임포트 (DB에 데이터 없을 때만)"""
    import os
    seed_path = os.path.join(os.path.dirname(__file__), '..', 'seed_data', 'newsdesk_seed.json')
    if not os.path.exists(seed_path):
        return

    from app.models.newsdesk import NewsDesk, RawNews
    db = next(get_db())
    try:
        with open(seed_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        from datetime import datetime, date

        added_nd = 0
        added_rn = 0
        for nd in data.get('newsdesks', []):
            pub_date = date.fromisoformat(nd['publish_date'])
            existing = db.query(NewsDesk).filter(NewsDesk.publish_date == pub_date).first()
            if existing:
                continue
            newsdesk = NewsDesk(
                publish_date=pub_date,
                columns=nd.get('columns'),
                news_cards=nd.get('news_cards'),
                keywords=nd.get('keywords'),
                sentiment=nd.get('sentiment'),
                top_stocks=nd.get('top_stocks'),
                status=nd.get('status', 'ready'),
                raw_news_count=nd.get('raw_news_count', 0),
                generation_count=nd.get('generation_count', 0),
                last_generated_at=datetime.fromisoformat(nd['last_generated_at']) if nd.get('last_generated_at') else None,
            )
            db.add(newsdesk)
            added_nd += 1

            # 해당 날짜의 원본 뉴스도 추가
            for rn in data.get('raw_news', []):
                if rn.get('newsdesk_date') != nd['publish_date']:
                    continue
                raw = RawNews(
                    source=rn['source'],
                    title=rn['title'],
                    description=rn.get('description'),
                    link=rn.get('link'),
                    pub_date=datetime.fromisoformat(rn['pub_date']) if rn.get('pub_date') else None,
                    collected_at=datetime.fromisoformat(rn['collected_at']) if rn.get('collected_at') else None,
                    keywords=rn.get('keywords'),
                    sentiment=rn.get('sentiment'),
                    newsdesk_date=pub_date,
                )
                db.add(raw)
                added_rn += 1

        if added_nd > 0:
            db.commit()
            print(f"뉴스데스크 시드 완료: {added_nd}개 뉴스데스크, {added_rn}개 원본뉴스")
        else:
            print("뉴스데스크 시드: 추가할 데이터 없음 (모두 존재)")
    except Exception as e:
        db.rollback()
        print(f"뉴스데스크 시드 실패: {e}")
    finally:
        db.close()


@app.on_event("startup")
async def startup_event():
    init_scheduler()
    # 뉴스데스크 시드 데이터 임포트
    _seed_newsdesk_data()
    # 한국 종목 목록 미리 로드 (첫 검색 시 지연 방지)
    print("한국 종목 목록 로드 시작...")
    try:
        await stock_search_service.load_korean_stocks()
        print(f"한국 종목 목록 로드 완료 (총 {len(stock_search_service._korean_stocks_list)}개)")
    except Exception as e:
        print(f"한국 종목 목록 로드 실패: {e}")
    print("Fund Team Messenger API started")


@app.on_event("shutdown")
async def shutdown_event():
    shutdown_scheduler()
    print("Fund Team Messenger API shutdown")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
