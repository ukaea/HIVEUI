# HiveUI Metadata Ingestion

Ingestion frontend for the HIVE experiment at UKAEA

## Features

- **Experiment & Configuration Management** - Create and manage experiments, samples, and configurations
- **Run Workflow** - Multi-step workflow for runs: Metadata entry, Processing (Airflow DAG trigger), Pulse Annotation, and Ingestion to SciCat
- **Airflow Integration** - Trigger and monitor analysis pipelines via Apache Airflow (all credentials stay server-side)
- **Authentication & Authorization** - Keycloak-based auth with group-level access control

## Docker

To run the UI with Docker, clone the repository and configure environment variables in the `docker-compose.yaml` file (see `.env.example` for reference):

```sh
docker-compose up -d
```

The UI will be available at http://localhost:3000

## Development - Prerequisites

Before you begin, ensure you have met the following requirements:

- You have installed the latest version of [Node.js and npm](https://nodejs.org/en/download/)

Developed with Node.js v21.1.0 and npm v10.2.0

## Installing HiveUI

1. Clone the repository:

   ```sh
   git clone https://github.com/BDevT/HiveUI.git
   ```

2. Navigate to the project directory:

   ```sh
   cd HiveUI
   ```

3. Install the dependencies:
   ```sh
   npm install
   ```

4. Create a `.env` file in the root directory. Copy `.env.example` and fill in your values:

   ```sh
   cp .env.example .env
   ```

   See `.env.example` for all available configuration options and descriptions.

## Running HiveUI (Development)

1. Run a development server with npm:
   ```sh
   npm run dev -- --open
   ```

The UI will be available at http://localhost:5173

## Running HiveUI (Production)

1. Build with npm:
   ```sh
   npm run build
   ```
2. Serve with npm:
   ```sh
   npm run preview
   ```

The UI will be available at http://localhost:4173
