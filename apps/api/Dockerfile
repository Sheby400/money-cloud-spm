FROM node:22-alpine
WORKDIR /app
COPY apps/api/package*.json ./
RUN npm install --omit=dev --no-audit --no-found
COPY apps/api/src ./src
ENV NODE_ENV=production
EXPOSE 3001
USER node
CMD [ "node", "src/server.js" ]