FROM python:3.12-bookworm

#set workd directory
WORKDIR /app 
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists

WORKDIR /app
COPY . .

# Install Python dependencies
WORKDIR /app/superdoc
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Install Node.js dependencies
WORKDIR /app
RUN npm install

EXPOSE 8080
CMD ["npm", "dev:ts"]
EXPOSE 8080

#docker run -p 9000:8080 --rm --init  nexus_bot


