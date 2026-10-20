# Seerr Bot

A Discord bot that finds, requests, and manages movies and TV shows in Seerr from chat messages.

## Language

**Turn**:
One user message and everything the bot does until it replies, including tool calls.
_Avoid_: request, run

**Session**:
The turns of one user, kept until the user is idle for 30 minutes or uses `/reset`.
_Avoid_: conversation, history

**Usage**:
The tokens and the turn count recorded for one user since the bot started.
_Avoid_: stats, cost
