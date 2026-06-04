FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
ARG VITE_APP_VERSION
ENV VITE_APP_VERSION=$VITE_APP_VERSION
RUN npm run build

FROM nginx:alpine
RUN apk add --no-cache gettext
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf.template

EXPOSE 3000

CMD ["/bin/sh", "-c", "export API_UPSTREAM=${API_UPSTREAM:-http://localhost:3005} && envsubst '${API_UPSTREAM}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
