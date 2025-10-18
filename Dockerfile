FROM node:18-alpine

WORKDIR /app

# Copiar package.json e package-lock.json
COPY package*.json ./

# Instalar dependências
RUN npm install

# Copiar código do chatbot
COPY chatbot.js .

EXPOSE 3000

CMD ["node", "chatbot.js"]
