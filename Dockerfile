FROM node:20-slim

# Install Python, LaTeX (XeLaTeX), and required packages
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    texlive-xetex \
    texlive-fonts-recommended \
    texlive-lang-european \
    fonts-dejavu \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node dependencies
RUN npm install

# Copy Python requirements
COPY requirements.txt ./
RUN pip3 install --break-system-packages -r requirements.txt

# Copy application files
COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
