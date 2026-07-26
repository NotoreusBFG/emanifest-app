# Rough draft, built ahead of a real ask -- see docs/docker-deployment.md.
# Not yet used for the actual Vercel-hosted deployment; this exists for a
# future self-hosted/on-premises customer who can't or won't use a
# third-party SaaS. Multi-stage build using Next.js's `output: "standalone"`
# (next.config.ts) for a lean final image -- only the production
# dependencies actually traced/used end up in the runtime stage, not the
# full node_modules tree.
#
# Node 22, not 20 -- @supabase/supabase-js already warns at runtime that
# Node 20 and below are deprecated; no reason to bake that warning into a
# fresh image.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Real values are injected at container runtime (see docker-compose.yml /
# docs/docker-deployment.md) -- these build-time placeholders only need to
# be non-empty so `next build` doesn't fail while statically analyzing
# environment variable usage. NEXT_PUBLIC_* values specifically DO get
# baked into the client bundle at build time, unlike the server-only ones,
# so a real self-hosted deployment must rebuild the image with its own
# real NEXT_PUBLIC_SUPABASE_URL/ANON_KEY rather than overriding them later.
ENV NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Runs as a non-root user, standard container hardening practice.
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
