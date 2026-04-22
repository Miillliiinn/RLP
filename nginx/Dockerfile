FROM debian:bookworm
RUN apt-get update && apt-get install -y \
    nginx \
    openssl \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /etc/ssl/certs /etc/ssl/private && \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -subj "/C=FR/ST=Paris/O=42/CN=tmilin.42.fr" \
    -keyout /etc/ssl/private/nginx.key \
    -out /etc/ssl/certs/nginx.crt

RUN chmod 777 /etc/ssl/private/nginx.key

COPY ./nginx.conf /etc/nginx/nginx.conf
EXPOSE 443
CMD ["nginx", "-g", "daemon off;"]