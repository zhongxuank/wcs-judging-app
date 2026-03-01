#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "Starting build process..."

# Install Python dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Build the React frontend
echo "Building React frontend..."
cd ..
npm ci
npm run build
cd wcs_judging

# Create static directory for Django
echo "Setting up static files..."
mkdir -p staticfiles

# Copy React build files to Django static directory
echo "Copying React build files..."
cp -r ../dist/* staticfiles/ 2>/dev/null || true

# Collect static files for Django (but don't overwrite our files)
echo "Collecting Django static files..."
python manage.py collectstatic --no-input --clear

# Re-copy React files after collectstatic
cp -r ../dist/* staticfiles/ 2>/dev/null || true

# Apply database migrations
echo "Applying database migrations..."
python manage.py migrate

echo "Build completed successfully!"