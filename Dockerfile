FROM php:8.2-cli-alpine

RUN docker-php-ext-install pdo_mysql

WORKDIR /var/www/html

COPY . .

ENV PORT=8080

EXPOSE 8080

CMD sh -c "php -S 0.0.0.0:${PORT} -t /var/www/html"
