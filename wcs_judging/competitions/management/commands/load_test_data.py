"""
Management command to load test data from CSV file.
Usage: python manage.py load_test_data [--competition-id UUID]
"""

import csv
import os

from django.core.management.base import BaseCommand, CommandError

from competitions.models import Competition, Competitor


class Command(BaseCommand):
    help = 'Load test competitors from test-competitors.csv'

    def add_arguments(self, parser):
        parser.add_argument(
            '--competition-id',
            type=str,
            help='UUID of an existing competition to add competitors to'
        )
        parser.add_argument(
            '--create-competition',
            action='store_true',
            help='Create a new competition with the test data'
        )
        parser.add_argument(
            '--csv-path',
            type=str,
            default='../test-competitors.csv',
            help='Path to the CSV file (default: ../test-competitors.csv)'
        )

    def handle(self, *args, **options):
        csv_path = options['csv_path']
        competition_id = options.get('competition_id')
        create_competition = options.get('create_competition')

        # Check if CSV file exists
        if not os.path.exists(csv_path):
            # Try alternate paths
            alternate_paths = [
                'test-competitors.csv',
                '../test-competitors.csv',
                '../../test-competitors.csv',
                os.path.join(os.path.dirname(__file__), '..', '..', '..', 'test-competitors.csv'),
            ]
            for path in alternate_paths:
                if os.path.exists(path):
                    csv_path = path
                    break
            else:
                raise CommandError(f'CSV file not found at {csv_path}')

        # Get or create competition
        if competition_id:
            try:
                competition = Competition.objects.get(id=competition_id)
                self.stdout.write(self.style.SUCCESS(f'Using existing competition: {competition.name}'))
            except Competition.DoesNotExist:
                raise CommandError(f'Competition with ID {competition_id} not found')
        elif create_competition:
            from datetime import date
            competition = Competition.objects.create(
                name='Test Competition',
                date=date.today(),
                chief_judge_name='Test Judge',
                status='setup'
            )
            self.stdout.write(self.style.SUCCESS(f'Created new competition: {competition.name} (ID: {competition.id})'))
        else:
            # Check if there are any competitions
            competition = Competition.objects.first()
            if not competition:
                raise CommandError(
                    'No competitions found. Use --create-competition to create one, '
                    'or --competition-id to specify an existing one.'
                )
            self.stdout.write(self.style.SUCCESS(f'Using first available competition: {competition.name}'))

        # Read CSV file
        created_count = 0
        skipped_count = 0
        errors = []

        try:
            with open(csv_path, 'r') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    try:
                        bib = row.get('bib', '').strip()
                        name = row.get('name', '').strip()
                        role = row.get('role', '').strip().lower()

                        if not bib or not name or not role:
                            errors.append(f'Skipping incomplete row: {row}')
                            continue

                        # Check if competitor already exists
                        if Competitor.objects.filter(competition=competition, bib_number=bib).exists():
                            skipped_count += 1
                            continue

                        Competitor.objects.create(
                            competition=competition,
                            bib_number=bib,
                            name=name,
                            role=role
                        )
                        created_count += 1

                    except Exception as e:
                        errors.append(f'Error processing row {row}: {e}')

        except FileNotFoundError:
            raise CommandError(f'CSV file not found: {csv_path}')
        except Exception as e:
            raise CommandError(f'Error reading CSV file: {e}')

        # Output results
        self.stdout.write(self.style.SUCCESS(f'\nImport complete:'))
        self.stdout.write(f'  Created: {created_count} competitors')
        self.stdout.write(f'  Skipped (already exist): {skipped_count} competitors')

        if errors:
            self.stdout.write(self.style.WARNING(f'\nWarnings/Errors ({len(errors)}):'))
            for error in errors[:10]:  # Show first 10 errors
                self.stdout.write(self.style.WARNING(f'  - {error}'))
            if len(errors) > 10:
                self.stdout.write(self.style.WARNING(f'  ... and {len(errors) - 10} more'))

        self.stdout.write(self.style.SUCCESS(f'\nCompetition ID for reference: {competition.id}'))