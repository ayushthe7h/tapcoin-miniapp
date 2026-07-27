import asyncio

from aiogram import Bot
from aiogram.exceptions import TelegramAPIError

from app.config import settings


async def send_broadcast(telegram_ids: list[int], title: str, message: str) -> tuple[int, int]:
    """Sends a message to each telegram id. Returns (sent_count, failed_count)."""
    bot = Bot(token=settings.BOT_TOKEN)
    sent, failed = 0, 0
    text = f"*{title}*\n\n{message}"

    try:
        # Telegram allows roughly 30 messages/sec to distinct chats — throttle gently.
        sem = asyncio.Semaphore(20)

        async def _send(chat_id: int):
            nonlocal sent, failed
            async with sem:
                try:
                    await bot.send_message(chat_id, text, parse_mode="Markdown")
                    sent += 1
                except TelegramAPIError:
                    failed += 1
                await asyncio.sleep(0.05)

        await asyncio.gather(*[_send(tid) for tid in telegram_ids])
    finally:
        await bot.session.close()

    return sent, failed
