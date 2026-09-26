# ABRASH OS — zero-dependency image (no npm install needed)
FROM node:22-alpine
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY index.html manifest.webmanifest icon.svg sw.js ./
COPY css/ ./css/
COPY js/ ./js/
COPY server/*.js server/*.sql ./server/
RUN mkdir -p server/data /app/backups && chown -R app:app /app
USER app
ENV PORT=3001
EXPOSE 3001
VOLUME ["/app/server/data"]
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- http://localhost:3001/healthz | grep -q '"ok":true'
CMD ["node", "server/server.js"]
