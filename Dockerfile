FROM node:20-alpine

WORKDIR /app

# Install deps (including browserify, which is in dependencies)
COPY package.json ./
RUN npm install --omit=dev

# Copy source
COPY . .

# Build the frontend bundle (reads blockchain/build/contracts/Voting.json
# which must be committed to the repo from a prior truffle migrate).
RUN npm run bundle

ENV PORT=8080
EXPOSE 8080

CMD ["node", "backend/server.js"]
