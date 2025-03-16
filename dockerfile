# Use Node.js as the base image
FROM node:18

# Install required dependencies
RUN apt-get update && apt-get install -y \
    openjdk-17-jdk \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user for better security
RUN useradd --create-home --shell /bin/bash appuser
USER appuser

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY --chown=appuser package*.json ./
RUN npm install --production

# Copy all project files
COPY --chown=appuser . .

# Expose port for communication
EXPOSE 3000

# Start the server
CMD ["node", "webservice.js"]
