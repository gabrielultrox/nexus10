---
name: autonomous-project-planner
description: Transform a product idea into a structured software delivery plan with core features, system architecture, tech-stack guidance, milestones, and implementation order. Use when a user shares an app idea, SaaS concept, software product description, or asks to turn a concept into a technical roadmap before coding.
---

# Autonomous Project Planner

Interpret the user's product idea before proposing implementation details.

Extract the product goal, target users, key workflows, constraints, and any explicit platform or business requirements. If critical details are missing, make reasonable assumptions and state them.

## Plan the Product

Turn the idea into a buildable scope:

- Define the product objective in plain language.
- Identify the smallest viable version of the product.
- Separate core features from later enhancements.
- Call out external integrations, data needs, and operational requirements.

## Design the System

Choose a pragmatic technical direction that fits the product:

- Propose a frontend, backend, data store, and deployment shape.
- Explain why the architecture matches the feature set and expected scale.
- Note security, authentication, payments, notifications, analytics, or admin tooling when relevant.
- Keep recommendations concrete and implementation-oriented rather than generic.

## Build the Roadmap

Organize delivery into phased execution:

1. Define the MVP milestone.
2. Break the work into sequential development phases.
3. Order implementation so foundational systems come first.
4. Highlight dependencies, risk areas, and sensible parallel workstreams.
5. End with the next practical build step.

## Output Format

Use this structure unless the user asks for a different format:

### Product Overview

Summarize the product, audience, and problem being solved.

### Feature List

Split features into:

- Core MVP features
- Secondary features
- Nice-to-have or future features

### Architecture

Describe:

- Client applications
- Backend/services
- Database/storage
- Third-party integrations
- Infrastructure/deployment

### Development Roadmap

List the implementation phases in order, with each phase focused on a coherent delivery milestone.

## Quality Bar

- Prioritize clarity over breadth.
- Favor implementation-ready recommendations.
- Avoid generating code until the planning work is complete unless the user explicitly asks to skip planning.
- Make tradeoffs visible when multiple architecture paths are reasonable.
