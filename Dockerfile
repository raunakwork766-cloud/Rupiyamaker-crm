# Multi-stage Docker build for Rupiyamaker CRM

# ========= Frontend Build Stage =========
FROM ubuntu:22.04 as frontend-builder

# Set environment variables to avoid interactive prompts
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Asia/Kolkata

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    gnupg \
    build-essential \
    tzdata \
    && ln -fs /usr/share/zoneinfo/$TZ /etc/localtime \
    && dpkg-reconfigure -f noninteractive tzdata \
    && rm -rf /var/lib/apt/lists/*

# Install nvm and Node.js 20
ENV NVM_DIR="/root/.nvm"
ENV NODE_VERSION="20"

RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash \
    && . "$NVM_DIR/nvm.sh" \
    && nvm install $NODE_VERSION \
    && nvm use $NODE_VERSION \
    && nvm alias default $NODE_VERSION

# Add node and npm to PATH
ENV PATH="$NVM_DIR/versions/node/v$NODE_VERSION/bin:$PATH"

WORKDIR /app/frontend

# Copy frontend package files
COPY rupiyamaker-UI/crm/package*.json ./

# Install frontend dependencies using nvm's node
RUN . "$NVM_DIR/nvm.sh" && nvm use $NODE_VERSION && npm install

# Copy frontend source code
COPY rupiyamaker-UI/crm/ .

# Note: For development mode, we'll start the dev server at runtime
# Build step is removed - development server will be started by entrypoint

# ========= Backend Build Stage =========
FROM python:3.11-slim as backend-builder

WORKDIR /app/backend

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements
COPY backend/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# ========= Final Production Stage =========
FROM ubuntu:22.04

# Set environment variables to avoid interactive prompts
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC

# Install system dependencies including nginx, certbot, and Node.js dependencies
RUN apt-get update && apt-get install -y \
    nginx \
    certbot \
    python3 \
    python3-pip \
    python3-venv \
    cron \
    curl \
    wget \
    gnupg \
    build-essential \
    tzdata \
    && ln -fs /usr/share/zoneinfo/$TZ /etc/localtime \
    && dpkg-reconfigure -f noninteractive tzdata \
    && rm -rf /var/lib/apt/lists/*

# Install nvm and Node.js 20 for runtime
ENV NVM_DIR="/root/.nvm"
ENV NODE_VERSION="20"

RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash \
    && . "$NVM_DIR/nvm.sh" \
    && nvm install $NODE_VERSION \
    && nvm use $NODE_VERSION \
    && nvm alias default $NODE_VERSION

# Add node and npm to PATH
ENV PATH="$NVM_DIR/versions/node/v$NODE_VERSION/bin:$PATH"

WORKDIR /app

# Copy and install Python dependencies
COPY backend/requirements.txt ./backend/
RUN pip3 install --no-cache-dir -r backend/requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Copy frontend source code and node_modules from builder
COPY --from=frontend-builder /app/frontend ./frontend

# Copy configuration files
COPY docker/nginx.conf /etc/nginx/sites-available/rupiyamaker
COPY docker/ssl-renew.sh /usr/local/bin/ssl-renew.sh
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh

# Make scripts executable
RUN chmod +x /usr/local/bin/ssl-renew.sh /usr/local/bin/entrypoint.sh

# Enable nginx site
RUN ln -s /etc/nginx/sites-available/rupiyamaker /etc/nginx/sites-enabled/
RUN rm /etc/nginx/sites-enabled/default

# Setup SSL renewal cron job (runs every 30 days)
RUN echo "0 0 */30 * * /usr/local/bin/ssl-renew.sh >> /var/log/ssl-renew.log 2>&1" | crontab -

# Create necessary directories
RUN mkdir -p /var/log/rupiyamaker /app/media

# Expose custom ports (5902 for dev server, 8049 for backend)
EXPOSE 5902 8049

# Set environment variables
ENV PYTHONPATH=/app/backend
ENV NODE_ENV=development
ENV PATH="$NVM_DIR/versions/node/v$NODE_VERSION/bin:$PATH"

# Reset DEBIAN_FRONTEND for normal operation
ENV DEBIAN_FRONTEND=


# Start services
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
