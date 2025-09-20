FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ENV PORT=3000
ENV NODE_ENV=development
EXPOSE 3000
CMD ["npx","nodemon","-L","src/app.ts"]
