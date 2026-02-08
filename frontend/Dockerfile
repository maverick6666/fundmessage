# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# 의존성 설치
COPY package*.json ./
RUN npm ci

# 앱 복사
COPY . .

# Docker용 환경변수 - .env 파일로 생성 (Vite가 읽을 수 있도록)
ARG VITE_API_URL=http://localhost:8000
ARG VITE_WS_URL=ws://localhost:8000
RUN echo "VITE_API_URL=$VITE_API_URL" > .env && echo "VITE_WS_URL=$VITE_WS_URL" >> .env

RUN npm run build

# Production stage
FROM nginx:alpine

# nginx 설정
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 빌드된 파일 복사
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
