from typing import Dict, List, Set, Optional
from fastapi import WebSocket
import json


class ConnectionManager:
    def __init__(self):
        # Active connections: {user_id: [websocket, ...]}
        self.active_connections: Dict[int, List[WebSocket]] = {}
        # Discussion rooms: {discussion_id: {user_id, ...}}
        self.discussion_rooms: Dict[int, Set[int]] = {}
        # Price subscriptions: {ticker: {user_id, ...}}
        self.price_subscriptions: Dict[str, Set[int]] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: int):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

        # Remove from all discussion rooms
        for discussion_id, users in list(self.discussion_rooms.items()):
            if user_id in users:
                users.remove(user_id)
                if not users:
                    del self.discussion_rooms[discussion_id]

        # Remove from all price subscriptions
        for ticker, users in list(self.price_subscriptions.items()):
            if user_id in users:
                users.remove(user_id)
                if not users:
                    del self.price_subscriptions[ticker]

    async def send_personal_message(self, message: dict, user_id: int):
        if user_id in self.active_connections:
            for websocket in self.active_connections[user_id]:
                try:
                    await websocket.send_json(message)
                except Exception:
                    pass

    async def send_to_users(self, user_ids: List[int], message: dict):
        for user_id in user_ids:
            await self.send_personal_message(message, user_id)

    async def broadcast(self, message: dict):
        for user_id in self.active_connections:
            await self.send_personal_message(message, user_id)

    # Discussion room methods
    def join_discussion(self, discussion_id: int, user_id: int):
        if discussion_id not in self.discussion_rooms:
            self.discussion_rooms[discussion_id] = set()
        self.discussion_rooms[discussion_id].add(user_id)

    def leave_discussion(self, discussion_id: int, user_id: int):
        if discussion_id in self.discussion_rooms:
            self.discussion_rooms[discussion_id].discard(user_id)
            if not self.discussion_rooms[discussion_id]:
                del self.discussion_rooms[discussion_id]

    async def broadcast_to_discussion(self, discussion_id: int, message: dict, exclude_user: Optional[int] = None):
        if discussion_id in self.discussion_rooms:
            for user_id in self.discussion_rooms[discussion_id]:
                if exclude_user and user_id == exclude_user:
                    continue
                await self.send_personal_message(message, user_id)

    def get_discussion_participants(self, discussion_id: int) -> Set[int]:
        return self.discussion_rooms.get(discussion_id, set())

    # Price subscription methods
    def subscribe_price(self, ticker: str, user_id: int):
        if ticker not in self.price_subscriptions:
            self.price_subscriptions[ticker] = set()
        self.price_subscriptions[ticker].add(user_id)

    def unsubscribe_price(self, ticker: str, user_id: int):
        if ticker in self.price_subscriptions:
            self.price_subscriptions[ticker].discard(user_id)
            if not self.price_subscriptions[ticker]:
                del self.price_subscriptions[ticker]

    async def broadcast_price_update(self, ticker: str, price_data: dict):
        if ticker in self.price_subscriptions:
            message = {
                "type": "price_update",
                "data": price_data
            }
            for user_id in self.price_subscriptions[ticker]:
                await self.send_personal_message(message, user_id)

    def get_subscribed_tickers(self) -> List[str]:
        return list(self.price_subscriptions.keys())
