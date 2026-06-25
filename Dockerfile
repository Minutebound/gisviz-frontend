# Use standard Node environment
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies first (for faster rebuilds)
COPY package.json package-lock.json* ./
RUN npm install

# Copy all local files into the container
COPY . .

# Expose Next.js port
EXPOSE 3001

# Start the Next.js development server
CMD ["npm", "run", "dev"]