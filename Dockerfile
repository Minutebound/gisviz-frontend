# Use standard Node environment
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies first (for faster rebuilds)
COPY package.json package-lock.json* ./

# Use legacy-peer-deps to bypass strict version conflicts with React 19
RUN npm install --legacy-peer-deps

# Copy all local files into the container
COPY . .

# Expose Next.js port
EXPOSE 3001

# Start the Next.js development server
CMD ["npm", "run", "dev"]