FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install && npm install @vitejs/plugin-react --save-dev
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]