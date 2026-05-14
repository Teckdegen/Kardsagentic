# @kard/agent — server image
#
# Build:   docker build -t kard .
# Run:     docker run --rm -it --env-file .env -v ~/.kard:/root/.kard kard
#
# Mount ~/.kard so the encrypted keystore + ledger + skills survive container
# restarts. KARD_PASSWORD must be in the env so the keystore auto-unlocks
# without an interactive prompt.

FROM node:22-alpine AS base
WORKDIR /app

# System deps (the agent doesn't actually need them at runtime, but git is
# needed in case someone installs a skill marketplace package via npm)
RUN apk add --no-cache git curl

# Install deps with cache layer
COPY package.json ./
RUN npm install --omit=dev --silent

# Copy source
COPY src ./src
COPY skills ./skills
COPY contracts ./contracts
COPY examples ./examples
COPY README.md kard.md LICENSE ./

# Hide bash history; container should never write to its own filesystem at runtime
ENV NODE_ENV=production \
    KARD_HOME=/root/.kard

# Healthcheck: agent prints its address on boot, daemon mode keeps the
# process alive forever. We just check that node is running.
HEALTHCHECK --interval=60s --timeout=10s --start-period=20s --retries=3 \
  CMD pgrep -f "node src/cli/index.js" > /dev/null || exit 1

# Default command: long-running daemon. Override at run time for one-shots.
ENTRYPOINT ["node", "src/cli/index.js"]
CMD ["daemon"]
