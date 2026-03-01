# WCS Judging System

A full-stack web application for managing West Coast Swing (WCS) dance competitions, featuring a React frontend and Django REST API backend with PostgreSQL database.

## Features

### Competition Management
- **Setup Wizard**: Step-by-step competition configuration
- **Judge Assignment**: Assign 3/5/7 judges per role with chief judge support
- **Competitor Import**: CSV upload with drag-and-drop support (78 test competitors included)
- **Round & Heat Generation**: Automatic heat generation with balanced distribution
- **Scoring Interface**: Real-time score entry with 0-100 scale
- **Results Dashboard**: Calculate and display preliminary and final results

### Technical Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS v4 |
| Backend | Django 4.2 + Django REST Framework |
| Database | PostgreSQL (production) / SQLite (development) |
| Deployment | Render (Web Service + PostgreSQL) |

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 20+
- PostgreSQL (for production) or SQLite (for development)

### Local Development

#### 1. Clone and Setup

```bash
git clone <your-repo-url>
cd wcs-judging
```

#### 2. Start Backend

```bash
cd wcs_judging

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Create admin user (optional)
python manage.py createsuperuser

# Start server
python manage.py runserver
```

Backend runs at http://localhost:8000/
- API: http://localhost:8000/api/
- Admin: http://localhost:8000/admin/

#### 3. Start Frontend

```bash
# In a new terminal (from project root)
npm install
npm run dev
```

Frontend runs at http://localhost:5173/

The Vite dev server automatically proxies API calls to Django.

### Deploying to Render

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

**Quick Deploy:**

1. Push code to GitHub
2. Connect to Render using the `render.yaml` blueprint
3. Render automatically creates:
   - PostgreSQL database
   - Web service with Django + React
   - Builds and deploys everything

## Project Structure

```
wcs-judging/
├── src/                           # React frontend
│   ├── components/
│   │   ├── competition/          # Competition setup components
│   │   │   ├── CompetitionSetup.tsx
│   │   │   ├── CompetitorImport.tsx
│   │   │   └── JudgeAssignment.tsx
│   │   ├── judging/              # Scoring components
│   │   │   └── ScoringInterface.tsx
│   │   └── common/               # Shared components
│   ├── services/api.ts           # API client for Django
│   └── types/index.ts            # TypeScript types
│
├── wcs_judging/                   # Django backend
│   ├── competitions/             # Main Django app
│   │   ├── models.py             # Competition, Judge, Competitor, Round, Heat, Score models
│   │   ├── serializers.py        # DRF serializers
│   │   ├── views.py              # API viewsets
│   │   ├── admin.py              # Django admin config
│   │   └── management/commands/  # Custom management commands
│   ├── wcs_judging/              # Django project settings
│   ├── templates/                # Django templates (index.html)
│   ├── requirements.txt          # Python dependencies
│   ├── build.sh                  # Render build script
│   └── render.yaml               # Render blueprint
│
├── test-competitors.csv          # Sample data (40 leaders, 38 followers)
└── DEPLOYMENT.md                 # Detailed deployment guide
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/competitions/` | List all competitions |
| `POST /api/competitions/` | Create a competition |
| `GET /api/judges/` | List judges |
| `POST /api/judges/bulk_create/` | Create multiple judges |
| `GET /api/competitors/` | List competitors |
| `POST /api/competitors/import_csv/` | Import from CSV |
| `GET /api/rounds/` | List rounds |
| `POST /api/rounds/{id}/generate_heats/` | Generate heats |
| `GET /api/rounds/{id}/results/` | Get round results |
| `POST /api/preliminary-scores/bulk_submit/` | Submit scores |

See `src/services/api.ts` for full API client implementation.

## CSV Import Format

The competitor import accepts CSV files with these columns:

```csv
bib,name,role
101,James Smith,leader
102,Michael Johnson,leader
201,Emma Turner,follower
202,Olivia Phillips,follower
```

- `bib`: Unique bib number
- `name`: Competitor's full name  
- `role`: Either "leader" or "follower"

## Management Commands

### Load Test Data

```bash
cd wcs_judging

# Create a new competition and load test competitors
python manage.py load_test_data --create-competition

# Load into existing competition
python manage.py load_test_data --competition-id <UUID>

# Specify custom CSV path
python manage.py load_test_data --csv-path /path/to/competitors.csv
```

## Django Admin

Access the admin interface at `/admin/` to manage:
- Competitions
- Judges
- Competitors
- Rounds & Heats
- Scores

## Development Tips

### Running Tests

```bash
# Django tests
cd wcs_judging
python manage.py test

# React tests (if configured)
npm test
```

### Database Migrations

```bash
cd wcs_judging

# Create migrations
python manage.py makemigrations

# Apply migrations
python manage.py migrate
```

### Static Files

In development, Vite handles assets. In production, WhiteNoise serves them:

```bash
cd wcs_judging

# Collect static files
python manage.py collectstatic
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Database connection string | Production |
| `SECRET_KEY` | Django secret key | Yes |
| `DEBUG` | Enable debug mode | Development only |
| `RENDER` | Set by Render automatically | Production |
| `WEB_CONCURRENCY` | Gunicorn workers | Recommended |

## Features in Detail

### Competition Setup
1. Enter competition name, date, and chief judge name
2. Assign judges (select 3/5/7 per role)
3. Import competitors via CSV
4. Generate rounds and heats

### Scoring Flow
1. Judges log scores (0-100) for each competitor
2. System automatically calculates results based on scoring algorithm
3. View results per round with sorting by total points
4. Advance competitors to next rounds

### Scoring Algorithm

Preliminary rounds use a point-based system:
- Yes: 5 points
- Alternate 1: 4 points
- Alternate 2: 3 points
- Alternate 3: 2 points
- No: 0 points

Finals use traditional 0-100 scoring with optional category breakdowns (technique, timing, presentation).

## Troubleshooting

### Common Issues

**CORS errors in development:**
- Ensure Django runs on port 8000
- Vite proxy is configured in `vite.config.ts`

**Static files not loading in production:**
- Check `build.sh` is copying files correctly
- Verify WhiteNoise is configured in `settings.py`

**Database connection errors:**
- Check `DATABASE_URL` is set correctly
- For Render, ensure database is in same region

See [DEPLOYMENT.md](DEPLOYMENT.md) for more troubleshooting tips.

## Contributing

This is a complete rehaul of a frontend-only React app into a full-stack Django application. The project demonstrates:

- Django REST Framework API design
- React-Django integration
- PostgreSQL database modeling
- Render deployment with build scripts
- CSV data import workflows
- Real-time scoring interfaces

## License

MIT License - See LICENSE file for details.

## Acknowledgments

- Built for West Coast Swing dance competition management
- Sample competitor data included for testing
- Deployment guide based on Render's Django documentation