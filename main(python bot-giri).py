import asyncio
import discord
import json
from discord.ext import commands
from dotenv import load_dotenv
import os
from flask import Flask, request, jsonify

load_dotenv()

TOKEN = os.getenv("DISCORD_TOKEN")
GUILD_NAME = "nexus"
JSON_FILE = "ecs_courses.json"

bot = commands.Bot(command_prefix="!", intents=discord.Intents.default())

app = Flask(__name__)


async def create_course_channels(guild):
    with open("data/ecs_courses.json", "r") as file:
        courses = json.load(file)

    for course in courses:
        channel_name = f"{course['title'].lower().replace(' ', '-')}-{course['instructors'][0].lower().replace(' ', '-')}"

        if not discord.utils.get(guild.channels, name=channel_name):
            overwrites = {
                guild.default_role: discord.PermissionOverwrite(view_channel=False),
            }
            await guild.create_text_channel(channel_name, overwrites=overwrites)
            print(f"Created channel {channel_name}.")
    print("Done creating channels.")


async def add_user_to_course_channel(discord_id, course_id, guild):
    with open(JSON_FILE, "r") as file:
        courses = json.load(file)

    course = next(
        (course for course in courses if course_id in course["class_numbers"]), None
    )
    if not course:
        print(f"Course with ID {course_id} not found.")
        return

    channel_name = f"{course['title']}-{course['instructors'][0]}"

    member = guild.get_member(discord_id)
    if not member:
        print(f"Member with Discord ID {discord_id} not found.")
        return

    channel = discord.utils.get(guild.channels, name=channel_name)
    await channel.set_permissions(member, read_messages=True)

    print(f"Added {member.name} to {channel_name}.")


@bot.event
async def on_ready():
    guild = discord.utils.get(bot.guilds, name=GUILD_NAME)
    if guild:
        await create_course_channels(guild)


@app.route("/add_user_to_course", methods=["POST"])
def add_user_to_course():
    discord_id = request.json.get("discord_id")
    course_id = request.json.get("course_id")

    if not discord_id or not course_id:
        return jsonify({"error": "Both discord_id and course_id are required"}), 400

    guild = discord.utils.get(bot.guilds, name=GUILD_NAME)
    if not guild:
        return jsonify({"error": f"Guild {GUILD_NAME} not found"}), 404

    asyncio.run(add_user_to_course_channel(discord_id, course_id, guild))

    return jsonify(
        {"message": f"User {discord_id} is being added to course {course_id}."}
    )


def run_flask():
    app.run(host="0.0.0.0", port=5001)


def run_bot():
    bot.run(TOKEN)


async def run():
    flask_thread = asyncio.to_thread(run_flask)
    bot_thread = asyncio.to_thread(run_bot)
    await asyncio.gather(flask_thread, bot_thread)


if __name__ == "__main__":
    asyncio.run(run())
