#!/bin/bash

# Servio AI Assistant - Setup Script
# This script sets up the AI assistant infrastructure

set -e

echo "🤖 Setting up Servio AI Assistant..."

# Check if required environment variables are set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL is not set"
  echo "Please set DATABASE_URL in your environment or .env file"
  exit 1
fi

if [ -z "$OPENAI_API_KEY" ]; then
  echo "⚠️  WARNING: OPENAI_API_KEY is not set"
  echo "The AI assistant will not work without an OpenAI API key"
  echo "Get one at: https://platform.openai.com/api-keys"
  echo ""
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Run database migration
echo "📊 Running database migration..."
if command -v psql &> /dev/null; then
  psql "$DATABASE_URL" -f migrations/ai-assistant-schema.sql
  echo "✅ Database migration completed"
else
  echo "❌ ERROR: psql command not found"
  echo "Please install PostgreSQL client or run the migration manually:"
  echo "  psql \$DATABASE_URL -f migrations/ai-assistant-schema.sql"
  exit 1
fi

# Verify tables were created
echo "🔍 Verifying tables..."
TABLES=$(psql "$DATABASE_URL" -t -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'ai_%';" | tr -d ' ' | grep -v '^$')

if echo "$TABLES" | grep -q "ai_action_audit"; then
  echo "  ✅ ai_action_audit table created"
else
  echo "  ❌ ai_action_audit table missing"
fi

if echo "$TABLES" | grep -q "ai_automations"; then
  echo "  ✅ ai_automations table created"
else
  echo "  ❌ ai_automations table missing"
fi

if echo "$TABLES" | grep -q "ai_context_cache"; then
  echo "  ✅ ai_context_cache table created"
else
  echo "  ❌ ai_context_cache table missing"
fi

if echo "$TABLES" | grep -q "ai_tool_definitions"; then
  echo "  ✅ ai_tool_definitions table created"
else
  echo "  ❌ ai_tool_definitions table missing"
fi

# Check tool definitions
echo "🔧 Checking tool definitions..."
TOOL_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM ai_tool_definitions;" | tr -d ' ')
echo "  Found $TOOL_COUNT tool definitions"

if [ "$TOOL_COUNT" -gt 0 ]; then
  echo "  ✅ Tools registered successfully"
else
  echo "  ⚠️  No tools found - migration may not have completed"
fi

# Install npm dependencies if needed
echo "📦 Checking npm dependencies..."
if ! npm list openai &> /dev/null; then
  echo "  Installing openai package..."
  npm install openai
fi

if ! npm list date-fns &> /dev/null; then
  echo "  Installing date-fns package..."
  npm install date-fns
fi

echo "✅ Dependencies verified"

# Create .env.example if it doesn't exist
if [ ! -f .env.example ]; then
  echo "📝 Creating .env.example..."
  cat >> .env.example << EOF

# AI Assistant
OPENAI_API_KEY=sk-proj-your-key-here
EOF
  echo "  ✅ .env.example updated"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Add your OpenAI API key to .env:"
echo "   OPENAI_API_KEY=sk-proj-..."
echo ""
echo "2. Restart your development server:"
echo "   npm run dev"
echo ""
echo "3. Press ⌘K (or Ctrl-K) in the dashboard to use the AI assistant"
echo ""
echo "📚 Read the documentation:"
echo "   - AI-ASSISTANT-README.md (comprehensive guide)"
echo "   - AI-ASSISTANT-INSTALLATION.md (integration guide)"
echo ""
echo "Happy building! 🚀"

