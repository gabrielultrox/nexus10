---
name: full-stack-architecture-designer
description: Design scalable full-stack application architectures across frontend, backend, database, integrations, and deployment infrastructure. Use when planning or evaluating applications that need a complete technical architecture, modular system design, folder structure, or end-to-end stack selection.
---

# Full-Stack Architecture Designer

Analyze the product requirements before proposing a technical design.

Identify the product goals, user flows, scale expectations, security needs, team constraints, and external integrations. If details are missing, make reasonable assumptions and state them clearly.

## Select the Stack

Choose technology based on product needs rather than defaults:

- Recommend a frontend framework and UI approach.
- Recommend backend services, APIs, and runtime choices.
- Recommend a database model and storage strategy.
- Recommend deployment and infrastructure components.
- Explain the main tradeoffs behind the stack choice.

## Define the Architecture

Describe the system as modular parts that can evolve independently:

### Frontend Architecture

Cover:

- Application structure
- Routing and state management
- Data fetching patterns
- Authentication and authorization touchpoints
- Shared UI/component strategy

### Backend Architecture

Cover:

- Service boundaries
- API style and responsibilities
- Background jobs, queues, or async workflows when needed
- Auth, permissions, observability, and error handling

### Database Structure

Cover:

- Primary data entities
- Relationships and access patterns
- Transactional vs analytical needs
- Caching, search, file storage, or event storage when relevant

### Deployment Strategy

Cover:

- Hosting model
- Environments
- CI/CD expectations
- Scaling approach
- Monitoring and operational considerations

## Output Format

Use this structure unless the user asks for something else:

### System Architecture

Summarize the full-stack design and how the major layers interact.

### Folder Structure

Provide a practical project structure that matches the recommended architecture.

### Tech Stack

List the recommended technologies and briefly justify each major choice.

## Quality Bar

- Favor modular, scalable designs over monolithic descriptions.
- Keep recommendations practical for the stated product stage.
- Make explicit when a simpler architecture is better than a highly distributed one.
- Keep the output implementation-oriented and ready to guide execution.
