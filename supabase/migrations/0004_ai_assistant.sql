-- MYCMO 0004: per-client switch for the AI report assistant.
-- When on, a summary of the client's dashboard numbers is sent to the chosen
-- AI provider (Anthropic or OpenAI) each time someone asks a question.
alter table organizations add column if not exists ai_enabled boolean not null default true;
