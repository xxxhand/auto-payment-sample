#!/bin/sh

# Local IPv4
if [ "$(uname)" = "Darwin" ]; then
  # macOS
  LOCAL_IPV4=$(ifconfig | grep -E 'inet [0-9]' | grep -v 127.0.0.1 | awk '{print $2}')
else
  # Ubuntu/Linux
  LOCAL_IPV4=$(hostname -I | awk '{print $1}')
fi

# 設為環境參數
export LOCAL_IPV4
echo "Local IPv4 Address: $LOCAL_IPV4"

# 從package.json 中取得版本、專案名稱並設為環境參數
export IMAGE_ID=$(grep '"name"' package.json | sed -E 's/.*"name": "(.*)".*/\1/')
echo "Using IMAGE_TAG: $IMAGE_ID"

export IMAGE_TAG=$(grep '"version"' package.json | sed -E 's/.*"version": "(.*)".*/\1/')
echo "Using IMAGE_TAG: $IMAGE_TAG"

# Image name for checking exist or not
IMAGE_NAME="$IMAGE_ID:$IMAGE_TAG"


# 若已存在則不加入 --build 參數
if docker images | grep -q "$IMAGE_NAME"; then
  echo "Image $IMAGE_NAME already exists. Running without --build."
  docker compose up -d
else
  echo "Image $IMAGE_NAME does not exist. Building the image."
  docker compose up --build -d
fi
