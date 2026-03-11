---
name: automated-code-generator
description: Generate production-ready code modules from defined architecture, feature structure, or technical design. Use after the architecture, module boundaries, or feature plan are established and the task is to turn those definitions into modular, maintainable, integration-compatible code with runnable examples.
---

# Automated Code Generator

Analyze the provided architecture before generating code.

Identify the system boundaries, module responsibilities, inputs and outputs, shared contracts, and integration points. If the architecture is incomplete, state the assumptions needed to produce coherent code.

## Plan the Modules

Break the architecture into implementation units:

- Identify each module or service to generate.
- Define what each module owns and what it depends on.
- Preserve clear separation of concerns.
- Prefer small, composable units over large mixed-responsibility files.

## Generate the Code

Produce code that is ready to run or easy to wire into the target project:

- Match the architecture and chosen stack.
- Keep interfaces explicit and integration-friendly.
- Use maintainable structure, naming, and error handling.
- Include supporting glue code when needed so modules work together.
- Avoid placeholders unless the user explicitly wants a scaffold.

## Validate Integration Fit

Before finalizing the output:

1. Check that module boundaries match the architecture.
2. Check that imports, exports, and contracts are consistent.
3. Check that generated examples use the modules correctly.
4. Call out any remaining assumptions, missing dependencies, or follow-up wiring.

## Output Format

Use this structure unless the user asks for something else:

### Module Description

Summarize the module purpose, responsibilities, and integration points.

### Source Code

Provide the implementation for the module or set of modules.

### Usage Instructions

Explain how to run, instantiate, or integrate the generated code.

## Quality Bar

- Prioritize production-oriented structure over toy examples.
- Keep code modular and easy to extend.
- Make integration compatibility explicit.
- Provide runnable examples whenever the target stack makes that practical.
