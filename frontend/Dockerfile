# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# 의존성 설치
COPY package*.json ./
RUN npm ci

# 앱 빌드
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

# nginx 설정
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 빌드된 파일 복사
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
