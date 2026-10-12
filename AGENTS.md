# Project Language

This is an open-source project. Write code comments, documentation, built-in skill names and descriptions, prompt instructions, and other developer-facing explanatory text in English.

Keep localized user-facing copy in the appropriate translation files. Explicitly localized documentation, such as README.zh-CN.md, may use its target language. Do not replace Chinese translations with English.

# Database Access

Drizzle ORM is the highest-priority choice for all application database operations. Reuse the project's Drizzle clients and typed schema for reads, writes, joins, and atomic batches or transactions. Do not bypass Drizzle with native database prepare/execute APIs when its query builder can express the operation.

Use parameterized Drizzle `sql` expressions only for database-specific operations that need them, composed with typed schema references. Never interpolate user input into raw SQL. Preserve authorization predicates, optimistic concurrency checks, and atomic writes when refactoring. Migration SQL and low-level database test adapters may use native APIs where required; they are not patterns for application code.
