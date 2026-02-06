from fastapi import APIRouter

from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.positions import router as positions_router
from app.api.requests import router as requests_router
from app.api.discussions import router as discussions_router
from app.api.stats import router as stats_router
from app.api.prices import router as prices_router
from app.api.notifications import router as notifications_router
from app.api.decision_notes import router as decision_notes_router
from app.api.columns import router as columns_router
from app.api.reports import router as reports_router
from app.api.attendance import router as attendance_router
from app.api.ai import router as ai_router
from app.api.trading_plans import router as trading_plans_router
from app.api.uploads import router as uploads_router

api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["Auth"])
api_router.include_router(users_router, prefix="/users", tags=["Users"])
api_router.include_router(positions_router, prefix="/positions", tags=["Positions"])
api_router.include_router(requests_router, prefix="/requests", tags=["Requests"])
api_router.include_router(discussions_router, prefix="/discussions", tags=["Discussions"])
api_router.include_router(stats_router, prefix="/stats", tags=["Stats"])
api_router.include_router(prices_router, prefix="/prices", tags=["Prices"])
api_router.include_router(notifications_router, prefix="/notifications", tags=["Notifications"])
api_router.include_router(decision_notes_router, prefix="/positions", tags=["Decision Notes"])
api_router.include_router(columns_router, prefix="/columns", tags=["Columns"])
api_router.include_router(reports_router, prefix="/reports", tags=["Reports"])
api_router.include_router(attendance_router, prefix="/attendance", tags=["Attendance"])
api_router.include_router(ai_router, prefix="/ai", tags=["AI"])
api_router.include_router(trading_plans_router, prefix="/positions", tags=["Trading Plans"])
api_router.include_router(uploads_router, prefix="/uploads", tags=["Uploads"])
