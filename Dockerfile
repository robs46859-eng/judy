# Use a slim Node.js stable base image
FROM node:20-alpine

# Set the working directory in the container
WORKDIR /app

# Copy dependency manifests first to leverage Docker layer caching
COPY package*.json ./

# Install packages
RUN npm install

# Copy all application source files
COPY . .

# Compile application assets (frontend + bundled backend inside dist/)
RUN npm run build

# Prune development dependencies to keep the image slim and secure
RUN npm prune --production

# Expose the correct application ingress port
EXPOSE 3000

# Set production flag
ENV NODE_ENV=production

# Start the Node.js production service
CMD ["npm", "start"]
