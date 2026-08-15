#!/bin/bash
# ==========================================
# deploy.sh - Script de despliegue rapido
# Uso: bash deploy.sh [plataforma]
# Plataformas: docker | railway | render | fly
# ==========================================

PLATFORM=${1:-docker}

echo "🏛️  Desplegando Museo Virtual en: $PLATFORM"

case $PLATFORM in
  docker)
    echo "🐳 Construyendo imagen Docker..."
    docker-compose down 2>/dev/null
    docker-compose up --build -d
    echo "✅ Museo Virtual corriendo en http://localhost:3000"
    ;;

  railway)
    echo "🚂 Desplegando en Railway..."
    if ! command -v railway &> /dev/null; then
      echo "❌ Instala Railway CLI: npm i -g @railway/cli"
      exit 1
    fi
    railway login
    railway link
    railway up
    echo "✅ Desplegado en Railway!"
    ;;

  render)
    echo "🎨 Desplegando en Render..."
    echo "1. Sube este repo a GitHub"
    echo "2. Ve a https://dashboard.render.com y crea un 'Web Service'"
    echo "3. Conecta tu repo y usa el plan 'Free'"
    echo "4. Render leera el archivo render.yaml automaticamente"
    ;;

  fly)
    echo "🚀 Desplegando en Fly.io..."
    if ! command -v flyctl &> /dev/null; then
      echo "❌ Instala Fly CLI: curl -L https://fly.io/install.sh | sh"
      exit 1
    fi
    flyctl auth login
    flyctl launch --dockerfile Dockerfile --name museo-virtual --region gru --no-deploy
    flyctl deploy
    echo "✅ Desplegado en Fly.io!"
    ;;

  *)
    echo "Uso: bash deploy.sh [docker|railway|render|fly]"
    exit 1
    ;;
esac
