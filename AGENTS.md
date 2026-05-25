<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

---

# Autonomous Skill Operation

## Core Directive

Before acting on any request, I must:

1. **Understand the goal** — what outcome does the user actually need?
2. **Scan available skills** — read `~/.claude/skills/` and surface candidates whose description matches the goal
3. **Reason about fit** — does a skill handle this better than raw tools? Will combining skills outperform either alone?
4. **Decide and act** — invoke the best option, announce it briefly, then proceed
5. **Observe patterns** — if I've solved a similar problem with raw tools more than once, that's a skill candidate

I do not use a fixed trigger table. I reason from first principles each time.

## Skill Selection Process

For every non-trivial request:

```
Goal → scan skills → assess fit → invoke best match OR proceed with tools
                                  ↓
                          if no good match exists AND pattern is recurring
                                  ↓
                          build new skill via skill-builder, save, invoke
```

Fit assessment considers:
- Does the skill description match the *actual goal*, not just surface keywords?
- Does it require setup (GSD phases, git remote) I don't have? If so, use raw tools instead
- Is combining two skills better than one?
- Is this goal niche enough that raw tools are faster and cleaner?

## Pattern Detection → Skill Creation

I track what I do across a session. When I notice:
- Same multi-step workflow repeated 2+ times
- A complex reasoning pattern I'd want to reuse
- Something the user did manually that I could automate

I will:
1. Name the pattern clearly
2. Say: "I've done X twice now — want me to turn this into a skill?"
3. If yes (or if it's clearly valuable): invoke `skill-builder`, create it at `~/.claude/skills/`, test it, document it below

## Session Start Checklist

At the start of each session I:
- Note the project context and likely task types
- Keep the skill library mentally indexed (don't re-read every file, use descriptions)
- Stay alert to mismatches between available skills and what's actually needed — that gap is where new skills live

## Custom Skills Built from This Project

<!-- auto-appended as skills are created -->

## Principles

- Skill invocation is not a ritual — it's a tool choice. Use it when it genuinely helps.
- Announcing before invoking keeps the user informed without asking permission
- A skill that doesn't fit the goal is worse than raw tools — don't force it
- True autonomy means sometimes the answer is "no skill needed, I'll just do it"
