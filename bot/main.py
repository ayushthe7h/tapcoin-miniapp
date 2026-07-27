import asyncio
import logging
import os

from aiogram import Bot, Dispatcher, F
from aiogram.filters import CommandStart, CommandObject
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.environ["BOT_TOKEN"]
WEBAPP_URL = os.environ["WEBAPP_URL"]
BOT_USERNAME = os.environ.get("BOT_USERNAME", "")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tapcoin-bot")

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()


@dp.message(CommandStart())
async def start_handler(message: Message, command: CommandObject):
    # command.args carries the referral code passed via ?start=CODE.
    #
    # IMPORTANT: Telegram only reliably forwards a start parameter into the Mini
    # App's initData.start_param when the app is opened via the official
    # `https://t.me/<bot_username>?startapp=<CODE>` direct-link mechanism (or the
    # Main Mini App's "Launch app" button). Appending a custom query string like
    # `?tgWebAppStartParam=` to a `web_app` inline button's URL is NOT part of
    # that mechanism and is known to silently drop the parameter on iOS/macOS
    # clients — which is why referrals looked broken for some users. So instead
    # of a web_app button, we send a normal URL button pointing at the official
    # startapp link and let Telegram handle opening the Mini App itself.
    ref_code = (command.args or "").strip()

    bot_username = BOT_USERNAME or (await bot.get_me()).username
    # Always use the ?startapp=... form — a plain https://t.me/<bot> link only
    # opens the chat, it does NOT launch the Mini App. Only the startapp
    # mechanism does that reliably. When there's no referral code we still
    # need *some* value here, so we send a harmless sentinel ("app") that the
    # backend simply won't match to any real referral_code.
    direct_link = f"https://t.me/{bot_username}?startapp={ref_code or 'app'}"

    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🚀 Open App", url=direct_link)]
        ]
    )
    await message.answer(
        "Welcome! Tap to earn USDT, complete tasks, and invite friends for bonus rewards.\n\n"
        "Tap the button below to open the app.",
        reply_markup=keyboard,
    )


@dp.message(F.text == "/help")
async def help_handler(message: Message):
    await message.answer(
        "Commands:\n/start — open the app\n/help — this message"
    )


async def main():
    logger.info("Starting bot polling...")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())