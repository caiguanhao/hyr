FROM node:0.12.0

MAINTAINER Cai Guanhao (caiguanhao@gmail.com)

WORKDIR /hyr

RUN python2.7 -c 'from urllib import urlopen; from json import loads; \
    print(loads(urlopen("http://ip-api.com/json").read().decode("utf-8" \
    ).strip())["countryCode"])' > /tmp/country

RUN test "$(cat /tmp/country)" = "CN" && { \
    (echo "registry = https://registry.npm.taobao.org" && \
    echo "disturl = https://npm.taobao.org/dist") \
    > ~/.npmrc; \
    } || true

ADD package.json /hyr/package.json

RUN npm --loglevel http install

ADD . /hyr
