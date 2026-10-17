# Source before `claude plugin eval` so Claude Code talks to the local proxy, never to Anthropic.
#   source scripts/cost-baseline/env.sh
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export EVAL_MODEL="${EVAL_MODEL:-deepseek/deepseek-v4-pro}"
export ANTHROPIC_BASE_URL="http://localhost:4000"
export ANTHROPIC_AUTH_TOKEN="$(cat "$HERE/.local-token")"
unset ANTHROPIC_API_KEY
export ANTHROPIC_MODEL="$EVAL_MODEL"
export ANTHROPIC_DEFAULT_OPUS_MODEL="$EVAL_MODEL"
export ANTHROPIC_DEFAULT_SONNET_MODEL="$EVAL_MODEL"
export ANTHROPIC_DEFAULT_HAIKU_MODEL="$EVAL_MODEL"
export ANTHROPIC_SMALL_FAST_MODEL="$EVAL_MODEL"
export CLAUDE_CODE_SUBAGENT_MODEL="$EVAL_MODEL"
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
export DISABLE_AUTOUPDATER=1
# Isolated config with no claude.ai login, so nothing can fall back to a subscription.
export CLAUDE_CONFIG_DIR="$HERE/.claude-config"
mkdir -p "$CLAUDE_CONFIG_DIR"
