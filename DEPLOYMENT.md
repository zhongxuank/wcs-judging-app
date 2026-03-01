# WCS Judging System - Deployment Guide

This document provides instructions for deploying the WCS Judging System on Render.

## Architecture Overview

The application consists of:
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Django + Django REST Framework + PostgreSQL
- **Deployment**: Render (Web Service + PostgreSQL Database)

## Prerequisites

1. A Render account (https://render.com)
2. A GitHub/GitLab/Bitbucket repository with this code
3. Python 3.11+ and Node.js 20+ installed locally for development

## Project Structure

```
wcs-judging/
├── src/                        # React frontend source
│   ├── components/             # React components
│   ├── services/api.ts       # API client for Django backend
│   └── types/                # TypeScript types
├── wcs_judging/               # Django project root
│   ├── competitions/          # Django app with models, views, serializers
│   ├── templates/            # Django templates (index.html for React)
│   ├── wcs_judging/          # Django project settings
│   ├── manage.py
│   ├── requirements.txt      # Python dependencies
│   ├── build.sh             # Render build script
│   └── render.yaml          # Render blueprint
├── test-competitors.csv     # Sample competitor data
├── package.json             # Node.js dependencies
├── vite.config.ts           # Vite configuration
└── render.yaml              # Render blueprint (root copy)
```

## Local Development

### 1. Clone and Setup

```bash
git clone <your-repo-url>
cd wcs-judging
```

### 2. Setup Backend

```bash
# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install Python dependencies
cd wcs_judging
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Start Django development server
python manage.py runserver
```

The Django API will be available at http://localhost:8000/api/

### 3. Setup Frontend

In a new terminal:

```bash
# Install Node.js dependencies
npm install

# Start Vite development server
npm run dev
```

The React frontend will be available at http://localhost:5173/

The Vite dev server is configured to proxy API requests to Django automatically.

### 4. Access Django Admin

Visit http://localhost:8000/admin/ and log in with the superuser credentials you created.

## Deploying to Render

### Method 1: Using render.yaml (Recommended)

1. Push your code to GitHub/GitLab/Bitbucket
2. Log in to Render Dashboard (https://dashboard.render.com)
3. Go to "Blueprints" and click "New Blueprint Instance"
4. Select your repository
5. Click "Connect"
6. Review the configuration and click "Apply"

Render will automatically:
- Create a PostgreSQL database
- Create a web service
- Run the build script
- Deploy your application

### Method 2: Manual Deployment

#### 1. Create PostgreSQL Database

1. In Render Dashboard, go to "PostgreSQL"
2. Click "New PostgreSQL"
3. Choose a name (e.g., "wcs-judging-db")
4. Select the free plan
5. Click "Create Database"
6. Copy the "Internal Database URL" for later

#### 2. Create Web Service

1. In Render Dashboard, go to "Web Services"
2. Click "New Web Service"
3. Select your repository
4. Configure the service:
   - **Name**: wcs-judging
   - **Runtime**: Python 3
   - **Build Command**: `cd wcs_judging && ./build.sh`
   - **Start Command**: `cd wcs_judging && python -m gunicorn wcs_judging.asgi:application -k uvicorn.workers.UvicornWorker`
5. Click "Create Web Service"

#### 3. Configure Environment Variables

In the web service settings, add the following environment variables:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | (Paste the internal database URL from step 1) |
| `SECRET_KEY` | (Click "Generate" to create a secure random key) |
| `WEB_CONCURRENCY` | 4 |
| `PYTHON_VERSION` | 3.11 |
| `NODE_VERSION` | 20 |
| `NPM_CONFIG_PRODUCTION` | false |

#### 4. Deploy

Click "Manual Deploy" > "Deploy latest commit" to trigger the first deployment.

## Post-Deployment Setup

### 1. Create Django Admin Account

After the first deployment, create a superuser via the Render Shell:

1. In Render Dashboard, go to your web service
2. Click "Shell" tab
3. Run:
   ```bash
   python manage.py createsuperuser
   ```

### 2. Access Your Application

- **Main Application**: `https://<your-service-name>.onrender.com`
- **Django Admin**: `https://<your-service-name>.onrender.com/admin/`
- **API Browser**: `https://<your-service-name>.onrender.com/api/`

### 3. Create Your First Competition

1. Visit the main application URL
2. Use the Competition Setup wizard to create a competition
3. Import competitors using the provided `test-competitors.csv` or your own CSV file
4. Assign judges
5. Generate rounds and heats
6. Start scoring!

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `SECRET_KEY` | Django secret key for security | Yes |
| `WEB_CONCURRENCY` | Number of Gunicorn workers | Recommended |
| `RENDER_EXTERNAL_HOSTNAME` | Set automatically by Render | Auto |
| `DEBUG` | Set to `True` only for development | No |

## Troubleshooting

### Build Failures

If the build fails, check the build logs in Render Dashboard:
1. Go to your web service
2. Click "Events" tab
3. Review the build output

Common issues:
- Missing Python dependencies: Check `requirements.txt`
- Node.js version mismatch: Ensure `NODE_VERSION` is set to 20
- Static files not found: Verify `build.sh` is copying files correctly

### Database Connection Issues

If you see database connection errors:
1. Verify `DATABASE_URL` is set correctly
2. Check that the database is in the same region as the web service
3. Ensure the database is fully provisioned (not still creating)

### API Errors

Check the API response in browser DevTools:
1. Open browser console (F12)
2. Go to Network tab
3. Look for failed API requests
4. Check the response for error details

### CORS Issues

If you see CORS errors in development:
1. Ensure Django is running on port 8000
2. Check that `CORS_ALLOWED_ORIGINS` in settings.py includes `http://localhost:5173`

## Updating Your Deployment

To deploy updates:

1. Make changes locally
2. Test locally
3. Commit and push to your repository
4. Render will automatically redeploy (or click "Manual Deploy")

## CSV File Format

The competitor import expects a CSV file with these columns:

```csv
bib,name,role
101,John Doe,leader
102,Jane Smith,follower
```

- `bib`: Bib number (unique identifier)
- `name`: Competitor's full name
- `role`: Either "leader" or "follower"

## Support

For issues or questions:
- Check the Django logs in Render Dashboard
- Review the browser console for frontend errors
- Verify all environment variables are set correctly

## Security Notes

- Never commit `SECRET_KEY` to version control
- Use strong passwords for admin accounts
- Enable HTTPS (Render provides this automatically)
- Regularly update dependencies