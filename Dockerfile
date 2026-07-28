# Kitap Rafı — Node/Express uygulaması
FROM node:22-alpine

WORKDIR /app

# Bağımlılıklar (yalnız production)
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Uygulama kodu
COPY . .

# Uygulama 3000'de dinler; dışarıya compose ile 127.0.0.1'e bağlanır
EXPOSE 3000

# data/ ve uploads/ compose'da volume olarak bağlanır (kalıcı veri)
CMD ["node", "server.js"]
